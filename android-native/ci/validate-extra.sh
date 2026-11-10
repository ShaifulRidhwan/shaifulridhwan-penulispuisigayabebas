#!/usr/bin/env bash
set -euo pipefail
out=docs/android-rebuild/visual-comparison/performance/extra-validation
mkdir -p "$out"
run_suite() {
  local suite=$1
  local result="$out/$suite.txt"
  adb shell am instrument -w -r -e class "my.aksara.nativeapp.$suite" my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$result"
  cat "$result"
  grep -Eq '^OK \([0-9]+ tests?\)' "$result"
}
run_suite P3P4SettingsUiTest
run_suite P4EncryptedDraftStoreAndroidTest
run_suite NativeGameAssetsTest
adb shell pm grant my.aksara.nativeapp android.permission.RECORD_AUDIO
run_suite LiveVoiceLifecycleTest
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/live-audio-lifecycle.json "$out/"
# Revoke only after instrumentation exits: revoking an in-use permission can
# kill the app process and must not masquerade as an instrumentation crash.
adb shell pm revoke my.aksara.nativeapp android.permission.RECORD_AUDIO
adb shell am start -W -n my.aksara.nativeapp/.MainActivity > "$out/final-launch.txt"
adb logcat -d -b crash > "$out/crashes.txt"
