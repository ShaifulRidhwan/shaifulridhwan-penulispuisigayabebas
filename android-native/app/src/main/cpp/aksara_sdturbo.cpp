#include <jni.h>
#include <cstdint>
#include <cstdlib>
#include <mutex>
#include <string>
#include <android/log.h>
#include "stable-diffusion.h"

// Native CPU-only SD-Turbo inference. No networking, shell commands, or WebView.
namespace {
std::mutex inference_mutex;
void throw_java(JNIEnv* env, const char* message) {
    jclass cls = env->FindClass("java/io/IOException");
    if (cls) env->ThrowNew(cls, message);
}
}

extern "C" JNIEXPORT jintArray JNICALL
Java_my_aksara_nativeapp_feature_studio_LocalSDTurboEngine_generateNative(
    JNIEnv* env, jobject /*thiz*/, jstring modelPath, jstring prompt, jlong seed, jint threads) {
    std::lock_guard<std::mutex> lock(inference_mutex);
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

    sd_ctx_t* ctx = new_sd_ctx(&init_params);
    if (!ctx) {
        throw_java(env, "Gagal memuat model SD-Turbo dalam native runtime.");
        return nullptr;
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
    const bool generated = generate_image(ctx, &image_params, &result, &output_count);
    if (!generated || !result || output_count < 1 || !result[0].data || result[0].width != 512 || result[0].height != 512 || result[0].channel < 3) {
        if (result) {
            free(result[0].data);
            free(result);
        }
        free_sd_ctx(ctx);
        throw_java(env, "SD-Turbo tidak memulangkan imej 512x512 yang sah.");
        return nullptr;
    }
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
    free(result[0].data);
    free(result);
    free_sd_ctx(ctx);
    return output;
}
