#!/usr/bin/env bash
set -euo pipefail
out=docs/android-rebuild/visual-comparison
mkdir -p "$out/android" "$out/performance"
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
for spec in '360 800' '390 844' '412 915'; do
  read -r width height <<< "$spec"
  adb shell wm size "${width}x${height}"
  adb shell wm density 160
  (cd android-native && ./gradlew --no-daemon connectedDebugAndroidTest)
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
stat -c %s android-native/app/build/outputs/apk/debug/app-debug.apk > "$out/performance/apk-bytes.txt"
python -m pip install pillow numpy scikit-image
python android-native/visual-tests/compare.py
