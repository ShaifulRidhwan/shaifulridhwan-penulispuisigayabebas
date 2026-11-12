#!/bin/sh
# Short, bounded smoke benchmark: baseline data for PRoot vs native experiments.
# Run with: aksara-linux-benchmark
set -eu
start_ms() { date +%s%3N; }
measure() {
  label="$1"
  shift
  before="$(start_ms)"
  "$@" >/dev/null
  after="$(start_ms)"
  printf '%-25s %6s ms\n' "$label" "$((after - before))"
}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
echo "=== AKSARA LINUX BENCHMARK ==="
echo "CPU: $(uname -m)  OS: $(. /etc/os-release; echo "$PRETTY_NAME")"
measure "shell spawn (40x)" sh -c 'i=0; while [ "$i" -lt 40 ]; do sh -c :; i=$((i+1)); done'
measure "python startup" python3 -c 'pass'
measure "node startup" node -e ''
measure "git init (local)" git -C "$tmp" init -q
measure "file create (1000)" sh -c 'i=0; while [ "$i" -lt 1000 ]; do printf x > "$1/file-$i"; i=$((i+1)); done' sh "$tmp"
echo "Disk: $(df -h /workspace 2>/dev/null | tail -1)"
echo "These are device-specific measurements, not cross-device benchmarks."
