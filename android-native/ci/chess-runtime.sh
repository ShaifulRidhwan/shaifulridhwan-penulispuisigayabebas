#!/usr/bin/env bash
set -euo pipefail
artifacts="${1:?APK artifact directory}"
mkdir -p chess-evidence
app_apk="$(find "$artifacts" -name app-debug.apk -print -quit)"
test_apk="$(find "$artifacts" -name app-debug-androidTest.apk -print -quit)"
adb install -r "$app_apk"
adb install -r "$test_apk"
adb logcat -c
adb shell am instrument -w -r -e class my.aksara.nativeapp.ChessAndroidTest my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner | tee chess-evidence/instrumentation.txt
# A transient logcat/ADB dump failure must not prevent pulling the essential
# screenshots and test-written proof. Preserve failures instead of hiding them.
diagnostic() {
 local name="$1"; shift
 if ! "$@" > "chess-evidence/$name" 2> "chess-evidence/$name.stderr"; then
  echo "::warning::Optional Android diagnostic $name failed; see captured stderr."
  printf '%s\n' "$name failed" >> chess-evidence/collection-warnings.txt
 fi
}
diagnostic logcat.txt adb logcat -d -t 3000
if ! adb pull /sdcard/Android/data/my.aksara.nativeapp/files/ chess-evidence/runtime-files; then
 adb wait-for-device
 adb pull /sdcard/Android/data/my.aksara.nativeapp/files/ chess-evidence/runtime-files
fi
diagnostic meminfo.txt adb shell dumpsys meminfo my.aksara.nativeapp
diagnostic framestats.txt adb shell dumpsys gfxinfo my.aksara.nativeapp framestats
diagnostic thermal.txt adb shell dumpsys thermalservice
grep -E 'OK \([0-9]+ tests?\)' chess-evidence/instrumentation.txt
if grep -En 'FAILURES|INSTRUMENTATION_FAILED|Process crashed' chess-evidence/instrumentation.txt; then exit 1; fi
for proof in chess-engine-match.txt chess-android.png chess-landscape.png chess-dark-queen-mate.png chess-renderer-cached-frames.txt chess-renderer-uncached-frames.txt chess-voice-playback.txt chess-process-cleanup.txt; do
 test -s "chess-evidence/runtime-files/$proof"
done
