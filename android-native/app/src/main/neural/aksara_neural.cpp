#include <vector>
#include <jni.h>
#include <string>
#include <mutex>
#include <atomic>
#include <algorithm>
#include "llama.h"

namespace {
std::mutex lock;
std::atomic<bool> cancelled{false};
llama_model* model = nullptr;
llama_context* ctx = nullptr;
}
extern "C" JNIEXPORT jboolean JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeLoad(JNIEnv* env, jobject, jstring path, jint contextSize) {
    std::lock_guard<std::mutex> guard(lock);
    if (ctx) { llama_free(ctx); ctx = nullptr; }
    if (model) { llama_model_free(model); model = nullptr; }
    if (!path || contextSize < 256 || contextSize > 8192) return JNI_FALSE;
    const char* chars = env->GetStringUTFChars(path, nullptr);
    if (!chars) return JNI_FALSE;
    auto params = llama_model_default_params();
    model = llama_model_load_from_file(chars, params);
    env->ReleaseStringUTFChars(path, chars);
    if (!model) return JNI_FALSE;
    auto cp = llama_context_default_params();
    cp.n_ctx = static_cast<uint32_t>(contextSize);
    cp.n_batch = 512;
    cp.n_ubatch = 512;
    ctx = llama_init_from_model(model, cp);
    if (!ctx) { llama_model_free(model); model = nullptr; return JNI_FALSE; }
    cancelled = false;
    return JNI_TRUE;
}
extern "C" JNIEXPORT jstring JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeGenerate(JNIEnv* env, jobject, jstring prompt, jint maxTokens) {
    std::lock_guard<std::mutex> guard(lock);
    if (!ctx || !model || !prompt || maxTokens < 1 || maxTokens > 2048) return env->NewStringUTF("");
    cancelled = false;
    const char* raw = env->GetStringUTFChars(prompt, nullptr);
    if (!raw) return env->NewStringUTF("");
    std::string input(raw);
    env->ReleaseStringUTFChars(prompt, raw);
    const llama_vocab* vocab = llama_model_get_vocab(model);
    int count = -llama_tokenize(vocab, input.c_str(), static_cast<int>(input.size()), nullptr, 0, true, true);
    if (count <= 0 || count >= static_cast<int>(llama_n_ctx(ctx))) return env->NewStringUTF("");
    const int remaining = static_cast<int>(llama_n_ctx(ctx)) - count;
    const int boundedTokens = std::min(static_cast<int>(maxTokens), remaining);
    std::vector<llama_token> tokens(count);
    if (llama_tokenize(vocab, input.c_str(), static_cast<int>(input.size()), tokens.data(), count, true, true) < 0) return env->NewStringUTF("");
    llama_memory_clear(llama_get_memory(ctx), true);
    llama_batch batch = llama_batch_get_one(tokens.data(), static_cast<int32_t>(tokens.size()));
    if (llama_decode(ctx, batch) != 0) return env->NewStringUTF("");
    llama_sampler_chain_params scp = llama_sampler_chain_default_params();
    llama_sampler* sampler = llama_sampler_chain_init(scp);
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(42));
    std::string output;
    for (int i = 0; i < boundedTokens && !cancelled; ++i) {
        llama_token token = llama_sampler_sample(sampler, ctx, -1);
        if (llama_vocab_is_eog(vocab, token)) break;
        char piece[512];
        int n = llama_token_to_piece(vocab, token, piece, sizeof(piece), 0, true);
        if (n > 0) output.append(piece, n);
        if (llama_decode(ctx, llama_batch_get_one(&token, 1)) != 0) break;
    }
    llama_sampler_free(sampler);
    return env->NewStringUTF(output.c_str());
}
extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeCancel(JNIEnv*, jobject) { cancelled = true; }
extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeUnload(JNIEnv*, jobject) {
    std::lock_guard<std::mutex> guard(lock);
    if (ctx) { llama_free(ctx); ctx = nullptr; }
    if (model) { llama_model_free(model); model = nullptr; }
}
