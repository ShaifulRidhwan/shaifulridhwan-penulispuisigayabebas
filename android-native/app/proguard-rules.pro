# Benchmark build only; normal CI preview package remains unchanged.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclasseswithmembernames class * {
    native <methods>;
}
