package my.aksara.nativeapp.core.neural;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.atomic.AtomicInteger;

/** Genuine host JNI smoke test. No Android/device performance claims. */
public final class LlamaNativeBridge {
    static { System.loadLibrary("aksara_neural"); }
    private native boolean nativeLoad(String path, int context, long ticket);
    private native long nativeTicket();
    private native int nativeGenerate(byte[][] roles, byte[][] contents, int maxTokens, long ticket);
    private native void nativeCancel();
    private native void nativeUnload();
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private final AtomicInteger streamed = new AtomicInteger();
    private boolean cancelOnToken;
    public void onNativeToken(byte[] bytes) {
        output.write(bytes, 0, bytes.length);
        streamed.incrementAndGet();
        if (cancelOnToken) nativeCancel();
    }
    private byte[][] utf8(String... values) {
        byte[][] result = new byte[values.length][];
        for (int i = 0; i < values.length; i++) result[i] = values[i].getBytes(StandardCharsets.UTF_8);
        return result;
    }
    public static void main(String[] args) throws Exception {
        LlamaNativeBridge bridge = new LlamaNativeBridge();
        if (!bridge.nativeLoad(args[0], 1024, bridge.nativeTicket())) throw new AssertionError("load failed");
        long start = System.nanoTime();
        int count = bridge.nativeGenerate(bridge.utf8("system", "user"), bridge.utf8(
            "You are a concise assistant. /no_think", "Sebut satu perkataan dalam Bahasa Melayu."), 48, bridge.nativeTicket());
        if (count <= 0 || bridge.streamed.get() != count || bridge.output.size() == 0) throw new AssertionError("No genuine streaming generation");
        System.out.println("HOST_REAL_GGUF tokens=" + count + " callbacks=" + bridge.streamed.get() + " elapsed_ms=" + (System.nanoTime() - start) / 1000000);
        System.out.println("OUTPUT=" + bridge.output.toString("UTF-8"));
        bridge.cancelOnToken = true;
        bridge.streamed.set(0); bridge.output.reset();
        int cancelled = bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("Write a long story."), 256, bridge.nativeTicket());
        if (cancelled > 1) throw new AssertionError("Cancellation did not stop generation");
        System.out.println("CANCEL_PASS tokens=" + cancelled);
        bridge.cancelOnToken = false;
        boolean bounded = false;
        try {
            bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("long prompt ".repeat(2000)), 32, bridge.nativeTicket());
        } catch (IllegalStateException expected) { bounded = expected.getMessage().contains("context"); }
        if (!bounded) throw new AssertionError("Context limit not enforced");
        System.out.println("CONTEXT_LIMIT_PASS");
        bridge.nativeUnload();
        boolean unloaded = false;
        try { bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("Hello"), 2, bridge.nativeTicket()); }
        catch (IllegalStateException expected) { unloaded = true; }
        if (!unloaded) throw new AssertionError("Generation after unload must fail");
        System.out.println("UNLOAD_PASS");
    }
}
