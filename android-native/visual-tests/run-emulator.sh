#!/usr/bin/env bash
set -euo pipefail
out=docs/android-rebuild/visual-comparison
mkdir -p "$out/android" "$out/performance"
finish_evidence() {
  adb pull /sdcard/Android/data/my.aksara.nativeapp/files/visual/. "$out/android/" >/dev/null 2>&1 || true
  adb logcat -d -b crash > "$out/performance/crashes.txt" || true
  adb logcat -d -s AndroidRuntime SQLiteLog Filament > "$out/performance/runtime-errors.txt" || true
}
trap finish_evidence EXIT
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put system font_scale 1.0
adb shell settings put secure immersive_mode_confirmations confirmed
adb install -r android-native/build-artifact/outputs/apk/debug/app-debug.apk
adb install -r android-native/build-artifact/outputs/apk/androidTest/debug/app-debug-androidTest.apk
failures=0
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeEngineTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/native-engine-tests.txt" || failures=$((failures+1))
cat "$out/android/native-engine-tests.txt"
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeCodeWebViewTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/browser-code-tests.txt" || failures=$((failures+1))
cat "$out/android/browser-code-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/browser-code-tests.txt"; then failures=$((failures+1)); fi
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/native-engine-tests.txt"; then failures=$((failures+1)); fi
for spec in '360 800' '390 844' '412 915'; do
  read -r width height <<< "$spec"
  adb shell wm size "${width}x${height}"
  adb shell wm density 160
  adb shell am instrument -w -r -e class my.aksara.nativeapp.VisualParityTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/test-${width}.txt" || failures=$((failures+1))
  cat "$out/android/test-${width}.txt"
  if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/test-${width}.txt"; then failures=$((failures+1)); fi
  adb pull /sdcard/Android/data/my.aksara.nativeapp/files/visual/. "$out/android/"
done
adb shell wm size 390x844
adb shell am force-stop my.aksara.nativeapp
adb shell am start -W -n my.aksara.nativeapp/.MainActivity > "$out/performance/cold-start.txt"
sleep 3
adb shell dumpsys meminfo my.aksara.nativeapp > "$out/performance/meminfo.txt"
adb shell dumpsys package my.aksara.nativeapp > "$out/performance/package.txt"
apk_path=$(adb shell pm path my.aksara.nativeapp | head -1 | tr -d "\r" | cut -d: -f2)
code_dir=${apk_path%/*}
adb shell run-as my.aksara.nativeapp du -sk "$code_dir" . > "$out/performance/installed-size.txt"
adb logcat -d -b crash > "$out/performance/crashes.txt"
stat -c %s android-native/build-artifact/outputs/apk/debug/app-debug.apk > "$out/performance/apk-bytes.txt"
python -m pip install pillow numpy scikit-image
comparison_status=0
python android-native/visual-tests/compare.py || comparison_status=$?
if [ "$failures" -ne 0 ] || [ "$comparison_status" -ne 0 ]; then exit 1; fi
