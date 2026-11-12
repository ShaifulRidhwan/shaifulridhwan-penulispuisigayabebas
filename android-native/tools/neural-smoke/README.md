# Genuine offline JNI smoke test (host)

This harness calls the same `aksara_neural.cpp` JNI bridge as Android. It loads an
actual GGUF and checks streaming, cancellation, context rejection and unload.
It does not emulate Android and does not establish device performance or UI parity.
No model is bundled and this test never downloads weights itself.

Prepare the pinned upstream with `scripts/prepare-neural-native.sh`. With a JDK
and CMake installed, build `app/src/main/neural` for the host (no Android toolchain),
then compile this Java file with `javac -d <classes> <source>` and run:

```
java -Djava.library.path=<cmake-build> -cp <classes> \
  my.aksara.nativeapp.core.neural.LlamaNativeBridge /path/to/verified-model.gguf
```

The audited Light model's SHA-256 must match the pinned catalog. Run the Java
process without network access after obtaining the model. Output is evidence,
not a scored benchmark. No 4B/8B weights are necessary.
