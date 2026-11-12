#include <jni.h>
#include <string>
#include <vector>
#include <mutex>
#include <atomic>
#include <algorithm>
#include <thread>
#include <cstdlib>
#include <memory>
#include <stdexcept>
#include "llama.h"

namespace {
std::mutex runtimeMutex;
std::once_flag backend;
std::atomic<int64_t> epoch{0};
llama_model* model = nullptr;
llama_context* ctx = nullptr;
int64_t activeEpoch = 0; // only accessed by decode's worker while holding runtimeMutex
bool abortDecode(void*) { return epoch.load() != activeEpoch; }
void release() {
    if (ctx) { llama_free(ctx); ctx = nullptr; }
    if (model) { llama_model_free(model); model = nullptr; }
}
void fail(JNIEnv* env, const char* message) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), message);
}
std::string bytes(JNIEnv* env, jbyteArray value) {
    const auto n = env->GetArrayLength(value);
    std::string result(n, '\0');
    env->GetByteArrayRegion(value, 0, n, reinterpret_cast<jbyte*>(result.data()));
    return result;
}
}
extern "C" JNIEXPORT jboolean JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeLoad(JNIEnv* env, jobject, jstring path, jint contextSize, jlong ticket) {
    std::lock_guard<std::mutex> guard(runtimeMutex);
    try {
        std::call_once(backend, [] { llama_backend_init(); });
        release();
        activeEpoch = ticket;
        if (abortDecode(nullptr)) throw std::runtime_error("Model load cancelled");
        if (!path || contextSize < 256 || contextSize > 4096) throw std::runtime_error("Invalid model path or context size");
        const char* chars = env->GetStringUTFChars(path, nullptr);
        if (!chars) return JNI_FALSE;
        auto params = llama_model_default_params();
        params.n_gpu_layers = 0;
        params.progress_callback = [](float, void*) { return !abortDecode(nullptr); };
        model = llama_model_load_from_file(chars, params);
        env->ReleaseStringUTFChars(path, chars);
        if (!model) throw std::runtime_error("GGUF loading failed: unsupported, corrupt, or insufficient memory");
        auto cp = llama_context_default_params();
        cp.n_ctx = static_cast<uint32_t>(std::min(static_cast<int32_t>(contextSize), llama_model_n_ctx_train(model)));
        // Keep prompt prefill large enough to avoid many JNI-independent decode passes.
        // Decode is memory-bandwidth-bound on mobile: oversubscribing little cores can regress speed.
        cp.n_batch = 512;
        cp.n_ubatch = 256;
        const unsigned cores = std::max(1u, std::thread::hardware_concurrency());
        const unsigned automaticThreads = cores >= 8 ? 4u : (cores >= 4 ? 3u : cores);
        cp.n_threads = static_cast<int32_t>(automaticThreads);
        cp.n_threads_batch = static_cast<int32_t>(std::min(cores, 4u));
        cp.abort_callback = abortDecode;
        ctx = llama_init_from_model(model, cp);
        if (!ctx) throw std::runtime_error("Context allocation failed; try Light or a smaller context");
        if (abortDecode(nullptr)) throw std::runtime_error("Model load cancelled");
        return JNI_TRUE;
    } catch (const std::exception& error) {
        release(); fail(env, error.what()); return JNI_FALSE;
    }
}
extern "C" JNIEXPORT jlong JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeTicket(JNIEnv*, jobject) { return ++epoch; }
extern "C" JNIEXPORT jint JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeGenerate(
    JNIEnv* env, jobject self, jobjectArray roles, jobjectArray contents, jint maxTokens, jlong ticket) {
    std::lock_guard<std::mutex> guard(runtimeMutex);
    try {
        if (!ctx || !model) throw std::runtime_error("Load a verified GGUF model first");
        activeEpoch = ticket;
        if (abortDecode(nullptr)) return 0;
        const auto size = env->GetArrayLength(roles);
        if (size != env->GetArrayLength(contents) || size < 1 || size > 33) throw std::runtime_error("Invalid conversation");
        std::vector<std::string> roleStrings, contentStrings;
        roleStrings.reserve(size); contentStrings.reserve(size);
        for (int i=0;i<size;++i) {
            auto role = static_cast<jbyteArray>(env->GetObjectArrayElement(roles, i));
            auto content = static_cast<jbyteArray>(env->GetObjectArrayElement(contents, i));
            roleStrings.push_back(bytes(env,role)); contentStrings.push_back(bytes(env,content));
            env->DeleteLocalRef(role); env->DeleteLocalRef(content);
        }
        std::vector<llama_chat_message> messages;
        for (int i=0;i<size;++i) messages.push_back({roleStrings[i].c_str(),contentStrings[i].c_str()});
        const char* tmpl = llama_model_chat_template(model, nullptr);
        if (!tmpl) throw std::runtime_error("GGUF has no chat template; select a supported instruct model");
        int length = llama_chat_apply_template(tmpl,messages.data(),messages.size(),true,nullptr,0);
        if (length <= 0) throw std::runtime_error("Unsupported GGUF chat template");
        std::string prompt(length,'\0');
        if (llama_chat_apply_template(tmpl,messages.data(),messages.size(),true,prompt.data(),length) != length)
            throw std::runtime_error("Chat template formatting failed");
        const auto* vocab = llama_model_get_vocab(model);
        int count = -llama_tokenize(vocab,prompt.data(),prompt.size(),nullptr,0,true,true);
        const int capacity = static_cast<int>(llama_n_ctx(ctx));
        if (count <= 0 || count + 64 >= capacity) throw std::runtime_error("Conversation exceeds context; clear the conversation or shorten the prompt");
        std::vector<llama_token> tokens(count);
        if (llama_tokenize(vocab,prompt.data(),prompt.size(),tokens.data(),count,true,true) != count)
            throw std::runtime_error("Tokenization failed");
        llama_memory_clear(llama_get_memory(ctx),true);
        for (int offset=0; offset<count; offset+=512) {
            if (abortDecode(nullptr)) return 0;
            int result = llama_decode(ctx,llama_batch_get_one(tokens.data()+offset,std::min(512,count-offset)));
            if (abortDecode(nullptr)) return 0;
            if (result != 0) throw std::runtime_error("Prompt decode failed; unload model to recover memory");
        }
        std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(
            llama_sampler_chain_init(llama_sampler_chain_default_params()),llama_sampler_free);
        llama_sampler_chain_add(sampler.get(),llama_sampler_init_top_k(40));
        llama_sampler_chain_add(sampler.get(),llama_sampler_init_top_p(0.9f,1));
        llama_sampler_chain_add(sampler.get(),llama_sampler_init_temp(0.6f));
        llama_sampler_chain_add(sampler.get(),llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
        auto klass = env->GetObjectClass(self);
        auto callback = env->GetMethodID(klass,"onNativeToken","([B)V");
        env->DeleteLocalRef(klass);
        if (!callback) return 0;
        const int limit = std::min(std::clamp(static_cast<int>(maxTokens),1,512),capacity-count);
        int generated=0;
        while (generated<limit && !abortDecode(nullptr)) {
            llama_token token = llama_sampler_sample(sampler.get(),ctx,-1);
            if (llama_vocab_is_eog(vocab,token)) break;
            std::vector<char> piece(256);
            int n = llama_token_to_piece(vocab,token,piece.data(),piece.size(),0,false);
            if (n<0) { piece.resize(-n); n=llama_token_to_piece(vocab,token,piece.data(),piece.size(),0,false); }
            if (n<0) throw std::runtime_error("Token conversion failed");
            auto output = env->NewByteArray(n);
            if (!output) return generated;
            env->SetByteArrayRegion(output,0,n,reinterpret_cast<const jbyte*>(piece.data()));
            env->CallVoidMethod(self,callback,output);
            env->DeleteLocalRef(output);
            if (env->ExceptionCheck()) return generated;
            ++generated;
            if (generated<limit) {
                const int result=llama_decode(ctx,llama_batch_get_one(&token,1));
                if (abortDecode(nullptr)) break;
                if (result!=0) throw std::runtime_error("Generation decode failed");
            }
        }
        return generated;
    } catch (const std::exception& error) { fail(env,error.what()); return 0; }
}
extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeCancel(JNIEnv*, jobject) { ++epoch; }
extern "C" JNIEXPORT void JNICALL
Java_my_aksara_nativeapp_core_neural_LlamaNativeBridge_nativeUnload(JNIEnv*, jobject) {
    std::lock_guard<std::mutex> guard(runtimeMutex); release();
}
