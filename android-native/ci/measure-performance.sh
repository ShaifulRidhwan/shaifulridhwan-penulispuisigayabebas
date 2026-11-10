#!/usr/bin/env bash
set -euo pipefail
out=${1:?Output directory}
mkdir -p "$out"
package=my.aksara.nativeapp
component=$package/.MainActivity
adb shell getprop > "$out/device-properties.txt"
adb shell dumpsys display > "$out/display.txt"
adb shell cat /proc/cpuinfo > "$out/cpuinfo.txt"
adb shell cat /proc/meminfo > "$out/device-memory.txt"
adb shell dumpsys thermalservice > "$out/thermal-before.txt"
adb shell dumpsys battery > "$out/battery-before.txt"
for setting in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$setting" 1
done
adb shell settings put system font_scale 1.0
adb shell settings put secure immersive_mode_confirmations confirmed
launch() {
  adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$component"
}
for repetition in $(seq 1 10); do
  adb shell am force-stop "$package"
  launch > "$out/cold-$repetition.txt"
  sleep 4
  adb shell input keyevent KEYCODE_HOME
  sleep 1
  launch > "$out/hot-$repetition.txt"
  sleep 1
  adb shell pidof "$package" > "$out/warm-pid-before-$repetition.txt"
  # Android 12+ Back on a root launcher activity only backgrounds the task.
  # CLEAR_TASK | NEW_TASK recreates the activity while retaining the process.
  adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
    -f 0x10008000 -n "$component" > "$out/warm-$repetition.txt"
  adb shell pidof "$package" > "$out/warm-pid-after-$repetition.txt"
  sleep 4
done
adb shell dumpsys gfxinfo "$package" framestats > "$out/startup-framestats.txt"
adb shell dumpsys meminfo "$package" > "$out/meminfo.txt"
adb shell dumpsys cpuinfo > "$out/cpuinfo-processes.txt"
adb shell dumpsys jobscheduler > "$out/jobscheduler.txt"
adb shell dumpsys alarm > "$out/alarms.txt"
adb shell dumpsys batterystats "$package" > "$out/batterystats.txt"
adb shell dumpsys thermalservice > "$out/thermal-after.txt"
adb shell dumpsys package "$package" > "$out/package.txt"
adb shell run-as "$package" du -sk . > "$out/app-private-footprint.txt"
apk_path=$(adb shell pm path "$package" | head -1 | tr -d '\r' | cut -d: -f2)
code_dir=${apk_path%/*}
adb shell run-as "$package" du -sk "$code_dir" . > "$out/installed-code-and-private.txt"
if [ -n "${APK_PATH:-}" ]; then
  stat -c %s "$APK_PATH" > "$out/apk-bytes.txt"
  sha256sum "$APK_PATH" > "$out/apk-sha256.txt"
fi
for repetition in 1 2 3; do
  result="$out/streaming-$repetition.txt"
  adb shell top -b -n 10 -d 1 > "$out/streaming-cpu-$repetition.txt" &
  cpu_sampler=$!
  adb shell am instrument -w -r -e class my.aksara.nativeapp.PerformanceFixtureTest \
    my.aksara.nativeapp.test/androidx.test.runner.AndroidJUnitRunner > "$result"
  wait "$cpu_sampler"
  cat "$result"
  grep -Eq '^OK \([0-9]+ tests?\)' "$result"
  adb pull "/sdcard/Android/data/$package/files/streaming-render-fixture.json" "$out/streaming-$repetition.json"
  adb shell dumpsys gfxinfo "$package" framestats > "$out/streaming-framestats-$repetition.txt"
done
adb logcat -d -b crash > "$out/crashes.txt"
python3 - "$out" <<'PY'
import json, pathlib, re, statistics, sys
root = pathlib.Path(sys.argv[1])
report = {'method': 'API35 debug emulator, animations 1x; 10 launches per mode; 3 UI rendering trials. Software GPU; no physical-device/battery/voice-quality inference.'}
for mode in ('cold', 'warm', 'hot'):
    rows = []
    for i in range(1, 11):
        text = (root / f'{mode}-{i}.txt').read_text()
        if 'Status: ok' not in text:
            raise SystemExit(f'{mode}-{i}: launch did not succeed')
        value = re.search(r'^TotalTime: (\d+)', text, re.M)
        if mode == 'warm' and (root / f'warm-pid-before-{i}.txt').read_text().strip() != (root / f'warm-pid-after-{i}.txt').read_text().strip():
            raise SystemExit(f'warm-{i}: process changed; sample is not a warm launch')
        rows.append(int(value.group(1)) if value else None)
    valid = [v for v in rows if v is not None]
    report[mode] = {'totalTimeMs': rows, 'medianMs': statistics.median(valid) if valid else None,
                    'note': 'Missing TotalTime is not treated as zero. Verify warm PID continuity from raw files.'}
report['streaming'] = []
for i in range(1, 4):
    trial = json.loads((root / f'streaming-{i}.json').read_text())
    frames = sorted(trial['frameTotalNs'])
    gpu = [v for v in trial['frameGpuNs'] if v >= 0]
    counters = {}
    for name in ('art.gc.gc-count', 'art.gc.gc-time', 'art.gc.bytes-allocated', 'art.gc.bytes-freed'):
        before, after = trial['runtimeBefore'].get(name), trial['runtimeAfter'].get(name)
        counters[name] = int(after)-int(before) if before is not None and after is not None else None
    report['streaming'].append({'trial': i, 'frames': len(frames),
        'medianMs': statistics.median(frames)/1e6,
        'p95Ms': frames[min(len(frames)-1, int(len(frames)*.95))]/1e6,
        'gpuMedianMs': statistics.median(gpu)/1e6 if gpu else None,
        'runtimeCounterDeltas': counters,
        'nativeHeapBytes': trial['nativeHeapBytes'], 'javaHeapUsedBytes': trial['javaHeapUsedBytes']})
memory = (root / 'meminfo.txt').read_text()
report['idleMemoryRawTotals'] = [line.strip() for line in memory.splitlines() if 'TOTAL' in line]
footprint = (root / 'installed-code-and-private.txt').read_text().splitlines()
report['installedFootprintKiB'] = {'codeDirectory':int(footprint[0].split()[0]), 'appPrivate':int(footprint[1].split()[0]), 'note':'du code directory plus app-private data; excludes shared OS caches'}
report['startupFrameSummary'] = [line.strip() for line in (root / 'startup-framestats.txt').read_text().splitlines() if 'Total frames rendered:' in line or 'Janky frames:' in line]
if (root / 'apk-bytes.txt').exists():
    report['apkBytes'] = int((root / 'apk-bytes.txt').read_text())
    report['apkSha256'] = (root / 'apk-sha256.txt').read_text().split()[0]
(root / 'summary.json').write_text(json.dumps(report, indent=2))
print('AKSARA_PERFORMANCE_SUMMARY=' + json.dumps(report))
PY
