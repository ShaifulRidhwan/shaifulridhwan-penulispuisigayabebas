#!/usr/bin/env python3
"""Fast CI invariants, not a replacement for physical-device benchmarks."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def read(path):
    return (root / path).read_text(encoding="utf-8")
def check(name, ok):
    if not ok:
        raise SystemExit(f"FAIL performance contract: {name}")
    print(f"PASS {name}")

style = read("app/src/main/res/values/styles.xml")
splash = read("app/src/main/java/my/aksara/nativeapp/feature/splash/AksaraSplash.kt")
chat = read("app/src/main/java/my/aksara/nativeapp/feature/chat/AksaraScreen.kt")
today = read("app/src/main/java/my/aksara/nativeapp/feature/today/TodayScreen.kt")
gradle = read("app/build.gradle.kts")
check("no extra startup delay", "animateTo(1f, tween(2300" not in splash)
check("branded OS splash icon", "@drawable/aksara_icon_transparent" in style and "@drawable/aksara_launch_empty" not in style)
check("IME on content not wallpaper", "Modifier.fillMaxSize().imePadding().safeDrawingPadding()" in chat)
check("stable chat content type", "contentType={it.role}" in chat)
check("spring animations retained", "aksaraBouncyClick" in read("app/src/main/java/my/aksara/nativeapp/feature/chat/ReactiveControls.kt") and "aksaraBouncyClick" in today and (root / "app/src/main/java/my/aksara/nativeapp/core/design/AksaraMotion.kt").exists())
check("Liquid Glass intact", "AksaraGlassSurface" in chat and "AksaraGlassSurface" in today)
check("voice preserved", (root / "app/src/main/java/my/aksara/nativeapp/feature/voice/VoiceScreen.kt").exists())
check("navigation preserved", (root / "app/src/main/java/my/aksara/nativeapp/feature/today/TodayMap.kt").exists())
check("Studio and games preserved", (root / "app/src/main/java/my/aksara/nativeapp/feature/studio/StudioWorkspace.kt").exists() and (root / "app/src/main/java/my/aksara/nativeapp/GameActivity.kt").exists())
check("on-device benchmarks opt-in", "aksaraPerformanceBenchmarks" in read("settings.gradle.kts"))
check("R8 benchmark build", 'create("benchmark")' in gradle and "isShrinkResources" in gradle)
check("ART profile installer", "androidx.profileinstaller:profileinstaller" in gradle)
print("AKSARA preservation contracts: all passed.")
