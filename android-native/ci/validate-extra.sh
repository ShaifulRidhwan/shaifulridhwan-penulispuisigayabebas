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
failures=0
run_suite P3P4SettingsUiTest || failures=$((failures+1))
run_suite P4EncryptedDraftStoreAndroidTest || failures=$((failures+1))
run_suite NativeGameAssetsTest || failures=$((failures+1))
adb shell pm grant my.aksara.nativeapp android.permission.RECORD_AUDIO || failures=$((failures+1))
run_suite LiveVoiceLifecycleTest || failures=$((failures+1))
adb pull /sdcard/Android/data/my.aksara.nativeapp/files/live-audio-lifecycle.json "$out/" || failures=$((failures+1))
if [ -s "$out/live-audio-lifecycle.json" ]; then
  python3 - "$out/live-audio-lifecycle.json" <<'PY'
import json,sys
print('AKSARA_LIVE_LIFECYCLE='+json.dumps(json.load(open(sys.argv[1]))))
PY
fi
# Revoke only after instrumentation exits: revoking an in-use permission can
# kill the app process and must not masquerade as an instrumentation crash.
adb shell pm revoke my.aksara.nativeapp android.permission.RECORD_AUDIO
adb shell am start -W -n my.aksara.nativeapp/.MainActivity > "$out/final-launch.txt"
adb logcat -d -b crash > "$out/crashes.txt"
if [ "$failures" -ne 0 ]; then
  echo "::error::$failures additional validation gate(s) failed; see preserved test results."
  exit 1
fi
