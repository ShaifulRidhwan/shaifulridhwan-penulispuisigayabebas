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
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeSessionPersistenceTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/session-persistence-tests.txt" || failures=$((failures+1))
cat "$out/android/session-persistence-tests.txt"
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeLibraryAssetsTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/library-assets-tests.txt" || failures=$((failures+1))
cat "$out/android/library-assets-tests.txt"
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeBackendNetworkTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/live-backend-tests.txt" || failures=$((failures+1))
cat "$out/android/live-backend-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/live-backend-tests.txt"; then failures=$((failures+1)); fi
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/library-assets-tests.txt"; then failures=$((failures+1)); fi
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/session-persistence-tests.txt"; then failures=$((failures+1)); fi
adb shell am instrument -w -r -e class my.aksara.nativeapp.AttributionAndLiteUiTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/attribution-lite-tests.txt" || failures=$((failures+1))
cat "$out/android/attribution-lite-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/attribution-lite-tests.txt"; then failures=$((failures+1)); fi
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeCodeWebViewTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/browser-code-tests.txt" || failures=$((failures+1))
cat "$out/android/browser-code-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/browser-code-tests.txt"; then failures=$((failures+1)); fi
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/native-engine-tests.txt"; then failures=$((failures+1)); fi
adb shell am instrument -w -r -e class my.aksara.nativeapp.StudioV2UiTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/studio-ui-tests.txt" || failures=$((failures+1))
cat "$out/android/studio-ui-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/studio-ui-tests.txt"; then failures=$((failures+1)); fi
adb shell am instrument -w -r -e class my.aksara.nativeapp.StudioHistoryAndroidTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/studio-history-tests.txt" || failures=$((failures+1))
cat "$out/android/studio-history-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/studio-history-tests.txt"; then failures=$((failures+1)); fi
adb shell am instrument -w -r -e class my.aksara.nativeapp.NativeGameActivityTest,my.aksara.nativeapp.PortalLayoutTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$out/android/game-activity-tests.txt" || failures=$((failures+1))
cat "$out/android/game-activity-tests.txt"
if ! grep -Eq '^OK \([0-9]+ tests?\)' "$out/android/game-activity-tests.txt"; then failures=$((failures+1)); fi
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/game-auto.png "$out/android/" || true
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/game-canvas.png "$out/android/" || true
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/game-auto-touch.png "$out/android/" || true
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/game-canvas-touch.png "$out/android/" || true
for spec in 640x360 844x390 1080x486 1280x800; do
  adb pull "/sdcard/Android/data/my.aksara.nativeapp/files/game-matrix-$spec.png" "$out/android/" || true
done
adb logcat -d -s AksaraGame > "$out/android/game-logcat.txt"
cat "$out/android/game-logcat.txt"
python3 - <<'PYSHOT'
import base64,json,pathlib
root=pathlib.Path("docs/android-rebuild/visual-comparison/android")
for name in ("game-auto.png","game-canvas.png","game-auto-touch.png","game-canvas-touch.png"):
 p=root/name
 if p.exists():
  encoded=base64.b64encode(p.read_bytes()).decode()
  for part,start in enumerate(range(0,len(encoded),16000)):
   print("AKSARA_GAME_SCREENSHOT "+json.dumps({"name":name,"part":part,"data":encoded[start:start+16000]}))
PYSHOT
for spec in '360 800' '390 844' '393 852' '412 915'; do
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
# Instrumentation is the functional emulator gate. The pixel-level Web/Native
# comparison is run separately by CI as a visible calibration report: it compares
# intentionally different products (Web has screens excluded from Native), so
# failures of that comparison must not disguise working device tests.
if [ "$failures" -ne 0 ]; then
  echo "::error title=Android instrumentation failed::$failures instrumentation suite(s) failed. Check captured test-*.txt evidence."
  exit 1
fi
echo "All required Android emulator instrumentation suites passed."
