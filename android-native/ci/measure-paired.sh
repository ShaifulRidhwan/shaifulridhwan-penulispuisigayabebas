#!/usr/bin/env bash
set -euo pipefail
out=docs/android-rebuild/visual-comparison/performance/paired
mkdir -p "$out"
install_pair() {
  local root=$1
  # Disposable CI emulator only. Independent builds use different debug keys.
  adb uninstall my.aksara.nativeapp.test >/dev/null 2>&1 || true
  adb uninstall my.aksara.nativeapp >/dev/null 2>&1 || true
  adb install "$root/outputs/apk/debug/app-debug.apk"
  adb install "$root/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
}
measure() {
  local root=$1 label=$2
  install_pair "$root"
  APK_PATH="$root/outputs/apk/debug/app-debug.apk" bash android-native/ci/measure-performance.sh "$out/$label"
}
measure android-native/baseline-artifact baseline-before
measure android-native/build-artifact final
measure android-native/baseline-artifact baseline-after
install_pair android-native/build-artifact
adb shell am start -W -n my.aksara.nativeapp/.MainActivity > "$out/final-installed-launch.txt"
python3 - "$out" <<'PY'
import json,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1])
before=json.loads((root/'baseline-before/summary.json').read_text())
after=json.loads((root/'baseline-after/summary.json').read_text())
final=json.loads((root/'final/summary.json').read_text())
controls=before['streaming']+after['streaming']
result={'method':'Same emulator A-B-A: baseline 3 trials, final 3 trials, baseline 3 trials. Fresh installs, 1x animations, unchanged measurement driver. Debug software GPU; finite samples, no physical-device claim.','metrics':{}}
for field in ('medianMs','p95Ms','gpuMedianMs','nativeHeapBytes','javaHeapUsedBytes'):
 a=[row[field] for row in controls if row[field] is not None]
 b=[row[field] for row in final['streaming'] if row[field] is not None]
 result['metrics'][field]={'baseline':a,'final':b,'baselineMedian':statistics.median(a) if a else None,'finalMedian':statistics.median(b) if b else None}
for field in ('art.gc.bytes-allocated','art.gc.gc-count','art.gc.gc-time'):
 a=[r['runtimeCounterDeltas'][field] for r in controls if r['runtimeCounterDeltas'][field] is not None]
 b=[r['runtimeCounterDeltas'][field] for r in final['streaming'] if r['runtimeCounterDeltas'][field] is not None]
 result['metrics'][field]={'baseline':a,'final':b,'baselineMedian':statistics.median(a) if a else None,'finalMedian':statistics.median(b) if b else None}
result['startup']={mode:{'baselineBefore':before[mode],'final':final[mode],'baselineAfter':after[mode]} for mode in ('cold','warm','hot')}
result['frameRegressionOutsideObservedControlRange']=statistics.median(r['p95Ms'] for r in final['streaming'])>max(r['p95Ms'] for r in controls)
(root/'comparison.json').write_text(json.dumps(result,indent=2))
print('AKSARA_PAIRED_COMPARISON='+json.dumps(result))
if result['frameRegressionOutsideObservedControlRange']:
 raise SystemExit('Final median p95 exceeds every baseline control trial; investigate before merging.')
PY
