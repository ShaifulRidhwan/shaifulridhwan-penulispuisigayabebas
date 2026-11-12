package my.aksara.nativeapp.core.neural;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.atomic.AtomicInteger;

/** Genuine host JNI smoke test. No Android/device performance claims. */
public final class LlamaNativeBridge {
    static { System.loadLibrary("aksara_neural"); }
    private native boolean nativeLoad(String path, int context, long ticket);
    private native long nativeTicket();
    private native int nativeGenerate(byte[][] roles, byte[][] contents, int maxTokens, long ticket, int threads);
    private native void nativeCancel();
    private native void nativeUnload();
    private native void nativeClearCache();
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private final AtomicInteger streamed = new AtomicInteger();
    private boolean cancelOnToken;
    private long[] metrics;
    public void onNativeStart() { }
    public void onNativeMetrics(long[] values) { metrics = values; }
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
    private int generate(String label, String prompt, int limit, int threads) {
        streamed.set(0); output.reset(); metrics = null;
        int tokens = nativeGenerate(utf8("system", "user"), utf8(
            "Anda Aksara, pembantu luar talian. Jawab ringkas dalam Bahasa Melayu Malaysia.", prompt),
            limit, nativeTicket(), threads);
        if (tokens <= 0 || streamed.get() != tokens || output.size() == 0) throw new AssertionError("Lost tokens: " + label);
        if (metrics == null || metrics.length != 10 || metrics[3] < 0) throw new AssertionError("Missing genuine metrics");
        System.out.printf(java.util.Locale.ROOT,
            "HOST_SAMPLE label=%s tokens=%d prompt=%d reused=%d prefill_ms=%.3f ttft_ms=%.3f decode_tps=%.3f threads=%d batch_threads=%d context=%d%n",
            label, tokens, metrics[0], metrics[1], metrics[2]/1000.0, metrics[3]/1000.0,
            metrics[4] > 0 ? metrics[5]*1000000.0/metrics[4] : 0.0, metrics[6], metrics[7], metrics[8]);
        System.out.println("OUTPUT=" + output.toString(StandardCharsets.UTF_8));
        return tokens;
    }
    public static void main(String[] args) throws Exception {
        LlamaNativeBridge bridge = new LlamaNativeBridge();
        if (!bridge.nativeLoad(args[0], 1024, bridge.nativeTicket())) throw new AssertionError("load failed");
        bridge.generate("fast-greeting", "oi\n/no_think", 48, 0);
        if (bridge.output.toString("UTF-8").contains("<think>")) throw new AssertionError("Fast mode generated a thinking block");
        bridge.generate("same-prompt-cache", "oi\n/no_think", 8, 0);
        if (bridge.metrics[1] <= 0) throw new AssertionError("Common prompt prefix was not reused");
        System.out.println("PREFIX_CACHE_PASS");
        bridge.cancelOnToken = true;
        bridge.streamed.set(0); bridge.output.reset();
        int cancelled = bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("Tulis cerita panjang.\n/no_think"), 256, bridge.nativeTicket(), 0);
        if (cancelled != 1 || bridge.streamed.get() != 1) throw new AssertionError("Cancellation did not stop after one token");
        if (bridge.metrics[9] < 0) throw new AssertionError("Missing cancellation timing");
        System.out.println("CANCEL_PASS tokens=" + cancelled + " cancel_us=" + bridge.metrics[9]);
        bridge.cancelOnToken = false;
        bridge.generate("after-cancel", "oi\n/no_think", 8, 0);
        if (bridge.metrics[1] != 0) throw new AssertionError("Cancelled KV state reused");
        long queuedTicket = bridge.nativeTicket(); bridge.nativeCancel();
        bridge.streamed.set(0);
        if (bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("oi"), 8, queuedTicket, 0) != 0 || bridge.streamed.get() != 0)
            throw new AssertionError("Queued generation escaped cancellation");
        System.out.println("QUEUED_CANCEL_PASS");
        boolean bounded = false;
        try {
            bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("long prompt ".repeat(2000)), 32, bridge.nativeTicket(), 0);
        } catch (IllegalStateException expected) { bounded = expected.getMessage().contains("context"); }
        if (!bounded) throw new AssertionError("Context limit not enforced");
        System.out.println("CONTEXT_LIMIT_PASS");
        for (int threads : new int[]{2, 4, 6}) {
            bridge.nativeClearCache();
            bridge.generate("compare-" + threads, "Terangkan mengapa langit biru dalam dua ayat.\n/no_think", 64, threads);
            if (bridge.metrics[1] != 0) throw new AssertionError("Comparison must start without prefix cache");
        }
        bridge.nativeUnload();
        boolean unloaded = false;
        try { bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("Hello"), 2, bridge.nativeTicket(), 0); }
        catch (IllegalStateException expected) { unloaded = true; }
        if (!unloaded) throw new AssertionError("Generation after unload must fail");
        System.out.println("UNLOAD_PASS");
        bridge.cancelOnToken = false;
        for (int cycle = 1; cycle <= 2; cycle++) {
            bridge.output.reset(); bridge.streamed.set(0);
            if (!bridge.nativeLoad(args[0], 1024, bridge.nativeTicket())) throw new AssertionError("Reload failed");
            int fresh = bridge.nativeGenerate(bridge.utf8("user"), bridge.utf8("Balas ringkas: selamat pagi.\n/no_think"), 8, bridge.nativeTicket(), 0);
            if (fresh <= 0 || fresh != bridge.streamed.get()) throw new AssertionError("No streaming after reload");
            bridge.nativeUnload();
            System.out.println("REACTIVATION_PASS cycle=" + cycle + " tokens=" + fresh);
        }
    }
}
