#include <jni.h>
#include <cstdint>
#include <cstdlib>
#include <mutex>
#include <atomic>
#include <chrono>
#include <string>
#include <android/log.h>
#include "stable-diffusion.h"

// Native CPU-only SD-Turbo inference. No networking, shell commands, or WebView.
namespace {
std::mutex inference_mutex;
std::mutex context_mutex;
std::atomic<bool> cancel_requested{false};
sd_ctx_t* active_context = nullptr;
void report_stage(JNIEnv* env, jobject callback, jint stage) {
    if (!callback || env->ExceptionCheck()) return;
    jclass klass = env->GetObjectClass(callback);
    if (!klass) return;
    jmethodID method = env->GetMethodID(klass, "onStage", "(I)V");
    if (method) env->CallVoidMethod(callback, method, stage);
    env->DeleteLocalRef(klass);
}
void release_images(sd_image_t* images, int count) {
    if (!images) return;
    for (int i = 0; i < count; ++i) free(images[i].data);
    free(images);
}
void throw_java(JNIEnv* env, const char* message) {
    jclass cls = env->FindClass("java/io/IOException");
    if (cls) env->ThrowNew(cls, message);
}
}

extern "C" JNIEXPORT jintArray JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_generateNative(
    JNIEnv* env, jobject /*thiz*/, jstring modelPath, jstring prompt, jlong seed, jint threads, jobject callback) {
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

    sd_ctx_params_t init_params;
    sd_ctx_params_init(&init_params);
    init_params.model_path = path.c_str();
    init_params.n_threads = threads;
    init_params.backend = "cpu";

    const auto load_started = std::chrono::steady_clock::now();
    report_stage(env, callback, 1);  // Model allocation / tensor loading.
    sd_ctx_t* ctx = new_sd_ctx(&init_params);
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "model load: %lld ms",
        static_cast<long long>(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - load_started).count()));
    if (!ctx) {
        throw_java(env, "Gagal memuat model SD-Turbo dalam native runtime.");
        return nullptr;
    }
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
    const auto generation_started = std::chrono::steady_clock::now();
    report_stage(env, callback, 2);  // Actual CPU diffusion / VAE decode.
    const bool generated = generate_image(ctx, &image_params, &result, &output_count);
    __android_log_print(ANDROID_LOG_INFO, "AksaraSDTurbo", "generation: %lld ms; success=%d; count=%d",
        static_cast<long long>(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - generation_started).count()), generated, output_count);
    {
        std::lock_guard<std::mutex> context_lock(context_mutex);
        active_context = nullptr;
    }
    const bool interrupted = cancel_requested.load(std::memory_order_acquire);
    if (interrupted || !generated || !result || output_count < 1 || !result[0].data || result[0].width != 512 || result[0].height != 512 || result[0].channel < 3) {
        release_images(result, output_count > 0 ? output_count : 0);
        free_sd_ctx(ctx);
        throw_java(env, interrupted ? "Penjanaan tempatan dibatalkan." : "SD-Turbo tidak memulangkan imej 512x512 yang sah.");
        return nullptr;
    }
    report_stage(env, callback, 3);  // Packing generated bitmap.
    const int count = 512 * 512;
    jintArray output = env->NewIntArray(count);
    if (output) {
        jint* pixels = env->GetIntArrayElements(output, nullptr);
        if (pixels) {
            const int channels = result[0].channel;
            for (int i = 0; i < count; ++i) {
                const uint8_t* p = result[0].data + i * channels;
                const uint32_t a = channels == 4 ? p[3] : 255;
                pixels[i] = static_cast<jint>((a << 24) | (p[0] << 16) | (p[1] << 8) | p[2]);
            }
            env->ReleaseIntArrayElements(output, pixels, 0);
        }
    }
    release_images(result, output_count);
    free_sd_ctx(ctx);
    return output;
}

extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_cancelNative(
    JNIEnv* /*env*/, jobject /*thiz*/) {
    cancel_requested.store(true, std::memory_order_release);
    std::lock_guard<std::mutex> context_lock(context_mutex);
    if (active_context) sd_cancel_generation(active_context, SD_CANCEL_ALL);
}
