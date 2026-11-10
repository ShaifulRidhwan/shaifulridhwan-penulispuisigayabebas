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
adb logcat -d > chess-evidence/logcat.txt
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/ chess-evidence/runtime-files || true
adb shell dumpsys meminfo my.aksara.nativeapp > chess-evidence/meminfo.txt
adb shell dumpsys gfxinfo my.aksara.nativeapp framestats > chess-evidence/framestats.txt
adb shell dumpsys thermalservice > chess-evidence/thermal.txt
grep -E 'OK \([0-9]+ tests?\)' chess-evidence/instrumentation.txt
if grep -En 'FAILURES|INSTRUMENTATION_FAILED|Process crashed' chess-evidence/instrumentation.txt; then exit 1; fi
