#!/usr/bin/env bash
set -euo pipefail
event=${1:?GitHub event name}
bash android-native/visual-tests/run-emulator.sh
validation_failed=0
bash android-native/ci/validate-extra.sh || validation_failed=1
if [ "$event" = pull_request ]; then
  bash android-native/ci/measure-paired.sh || validation_failed=1
fi
exit "$validation_failed"
