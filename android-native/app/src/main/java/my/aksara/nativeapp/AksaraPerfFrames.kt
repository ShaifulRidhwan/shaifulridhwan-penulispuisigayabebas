package my.aksara.nativeapp

import java.util.concurrent.atomic.AtomicLong

/** Debug opt-in; collect numbers only, never frame contents or chat text. */
internal object AksaraPerfFrames {
    private val frames = AtomicLong()
    private val janky = AtomicLong()
    private val maxNanos = AtomicLong()
    fun accept(isJank: Boolean, durationNanos: Long) {
        frames.incrementAndGet()
        if (isJank) janky.incrementAndGet()
        var previous = maxNanos.get()
        while (durationNanos > previous && !maxNanos.compareAndSet(previous, durationNanos)) {
            previous = maxNanos.get()
        }
    }
    fun snapshot(): Triple<Long, Long, Long> =
        Triple(frames.get(), janky.get(), maxNanos.get())
    fun reset() { frames.set(0); janky.set(0); maxNanos.set(0) }
}
