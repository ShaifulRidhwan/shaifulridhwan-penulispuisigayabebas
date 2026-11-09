#include <jni.h>
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <mutex>
#include <atomic>
#include <string>
#include <android/log.h>
#include "stable-diffusion.h"

// Native CPU-only SD-Turbo inference. No networking, shell commands, or WebView.
namespace {
std::mutex inference_mutex;
std::mutex context_mutex;
std::atomic<bool> cancel_requested{false};
sd_ctx_t* active_context = nullptr;
void throw_java(JNIEnv* env, const char* message) {
    jclass cls = env->FindClass("java/io/IOException");
    if (cls) env->ThrowNew(cls, message);
}
// Stage identifiers are safe for logcat. Never log a user prompt or model file path.
void fail_stage(JNIEnv* env, const char* stage, const char* message) {
    __android_log_print(ANDROID_LOG_ERROR, "AksaraSDTurbo", "failed_stage=%s", stage);
    const std::string detail = std::string(stage) + ": " + message;
    throw_java(env, detail.c_str());
}
bool inspect_gguf(const std::string& path) {
    std::FILE* file = std::fopen(path.c_str(), "rb");
    if (!file) return false;
    uint8_t header[8] = {};
    const size_t read = std::fread(header, 1, sizeof(header), file);
    std::fclose(file);
    if (read != sizeof(header)) return false;
    // GGUF is little-endian. Version 2 and 3 are supported by the pinned loader.
    const uint32_t version = static_cast<uint32_t>(header[4])
        | (static_cast<uint32_t>(header[5]) << 8)
        | (static_cast<uint32_t>(header[6]) << 16)
        | (static_cast<uint32_t>(header[7]) << 24);
    return header[0] == 'G' && header[1] == 'G' &&
        header[2] == 'U' && header[3] == 'F' && (version == 2 || version == 3);
}
sd_ctx_t* load_context(JNIEnv* env, const std::string& path, int threads) {
    if (!inspect_gguf(path)) {
        fail_stage(env, "SDT_MODEL_HEADER", "Model tidak boleh dibuka atau header GGUF tidak disokong.");
        return nullptr;
    }
    sd_ctx_params_t params;
    sd_ctx_params_init(&params);
    params.model_path = path.c_str();
    params.n_threads = threads;
    params.backend = "cpu";
    params.conditioning_cache_size = 0; // Reduce memory pressure on mobile.
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "stage=model_initialization");
    sd_ctx_t* ctx = new_sd_ctx(&params);
    if (!ctx) fail_stage(env, "SDT_MODEL_INIT", "Native runtime gagal memuat tensor/model; semak RAM dan logcat.");
    return ctx;
}
void free_images(sd_image_t* images, int image_count) {
    if (!images) return;
    for (int i = 0; i < image_count; ++i) std::free(images[i].data);
    std::free(images);
}
}

extern "C" JNIEXPORT jintArray JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_generateNative(
    JNIEnv* env, jobject /*thiz*/, jstring modelPath, jstring prompt, jlong seed, jint threads) {
    std::lock_guard<std::mutex> lock(inference_mutex);
    cancel_requested.store(false, std::memory_order_release);
    if (!modelPath || !prompt || threads < 1 || threads > 8) {
        throw_java(env, "Parameter native SD-Turbo tidak sah.");
        return nullptr;
    }
    const char* path_raw = env->GetStringUTFChars(modelPath, nullptr);
    const char* prompt_raw = env->GetStringUTFChars(prompt, nullptr);
    if (!path_raw || !prompt_raw) {
        if (path_raw) env->ReleaseStringUTFChars(modelPath, path_raw);
        if (prompt_raw) env->ReleaseStringUTFChars(prompt, prompt_raw);
        return nullptr;
    }
    const std::string path(path_raw);
    const std::string text(prompt_raw);
    env->ReleaseStringUTFChars(modelPath, path_raw);
    env->ReleaseStringUTFChars(prompt, prompt_raw);

    sd_ctx_t* ctx = load_context(env, path, threads);
    if (!ctx) return nullptr;
    if (cancel_requested.load(std::memory_order_acquire)) {
        free_sd_ctx(ctx);
        throw_java(env, "Penjanaan tempatan dibatalkan semasa memuat model.");
        return nullptr;
    }
    {
        std::lock_guard<std::mutex> context_lock(context_mutex);
        active_context = ctx;
    }
    sd_img_gen_params_t image_params;
    sd_img_gen_params_init(&image_params);
    image_params.prompt = text.c_str();
    image_params.negative_prompt = "";
    image_params.width = 512;
    image_params.height = 512;
    image_params.seed = static_cast<int64_t>(seed);
    image_params.sample_params.sample_steps = 1;
    // stable-diffusion.cpp CFG=1.0 disables CFG; Diffusers guidance_scale=0.
    image_params.sample_params.guidance.txt_cfg = 1.0f;
    image_params.sample_params.sample_method = EULER_A_SAMPLE_METHOD;

    sd_image_t* result = nullptr;
    int output_count = 0;
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "stage=sampling_and_decode");
    const bool generated = generate_image(ctx, &image_params, &result, &output_count);
    {
        std::lock_guard<std::mutex> context_lock(context_mutex);
        active_context = nullptr;
    }
    const bool interrupted = cancel_requested.load(std::memory_order_acquire);
    if (interrupted || !generated || !result || output_count < 1 || !result[0].data ||
        result[0].width != 512 || result[0].height != 512 ||
        (result[0].channel != 3 && result[0].channel != 4)) {
        // A failed generation may provide a non-null array with zero images.
        // Never dereference images[0] when image_count is zero.
        free_images(result, output_count > 0 ? output_count : 0);
        free_sd_ctx(ctx);
        fail_stage(env, interrupted ? "SDT_CANCELLED" : "SDT_SAMPLING_DECODE",
                   interrupted ? "Penjanaan dibatalkan." : "Sampling/VAE tidak memulangkan imej RGB 512x512.");
        return nullptr;
    }
    const int count = 512 * 512;
    jintArray output = env->NewIntArray(count);
    if (!output) {
        free_images(result, output_count);
        free_sd_ctx(ctx);
        // The JVM usually has a pending OutOfMemoryError.
        if (!env->ExceptionCheck()) fail_stage(env, "SDT_BITMAP_ALLOC", "Memori piksel tidak mencukupi.");
        return nullptr;
    }
    jint* pixels = env->GetIntArrayElements(output, nullptr);
    if (!pixels) {
        free_images(result, output_count);
        free_sd_ctx(ctx);
        if (!env->ExceptionCheck()) fail_stage(env, "SDT_BITMAP_ALLOC", "Gagal mengalokasi buffer imej JNI.");
        return nullptr;
    }
    const int channels = result[0].channel;
    for (int i = 0; i < count; ++i) {
        const uint8_t* p = result[0].data + i * channels;
        const uint32_t a = channels == 4 ? p[3] : 255;
        pixels[i] = static_cast<jint>((a << 24) | (p[0] << 16) | (p[1] << 8) | p[2]);
    }
    env->ReleaseIntArrayElements(output, pixels, 0);
    free_images(result, output_count);
    free_sd_ctx(ctx);
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "stage=pixels_ready");
    return output;
}

extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_cancelNative(
    JNIEnv* /*env*/, jobject /*thiz*/) {
    cancel_requested.store(true, std::memory_order_release);
    std::lock_guard<std::mutex> context_lock(context_mutex);
    if (active_context) sd_cancel_generation(active_context, SD_CANCEL_ALL);
}

extern "C" JNIEXPORT jstring JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_probeNative(
    JNIEnv* env, jobject /*thiz*/, jstring modelPath, jint threads) {
    std::lock_guard<std::mutex> lock(inference_mutex);
    if (!modelPath || threads < 1 || threads > 8) {
        fail_stage(env, "SDT_PROBE_ARGS", "Parameter ujian pemuatan model tidak sah.");
        return nullptr;
    }
    const char* raw = env->GetStringUTFChars(modelPath, nullptr);
    if (!raw) return nullptr;
    const std::string path(raw);
    env->ReleaseStringUTFChars(modelPath, raw);
    sd_ctx_t* ctx = load_context(env, path, threads);
    if (!ctx) return nullptr;
    const char* version = sd_get_model_version_name(ctx);
    jstring result = env->NewStringUTF(version ? version : "Unknown");
    free_sd_ctx(ctx);
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "stage=model_initialization_passed");
    return result;
}
