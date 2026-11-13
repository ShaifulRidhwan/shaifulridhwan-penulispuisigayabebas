#!/bin/sh
# AKSARA Linux Pro: read-only guest capability inventory.
# Availability is not proof of actual Android-device operation.
set -u
echo 'AKSARA LINUX · ADVANCED MODE · CAPABILITY INSPECTOR'
echo '---------------------------------------'
printf '[Alpine] '
grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null | head -n 1 || echo unknown
printf '[Architecture] '
uname -m
printf '[Workspace] '
if [ -d /workspace ]; then
  echo '/workspace available (app-private PRoot bind)'
else
  echo 'NOT AVAILABLE'
fi
printf '[File Bridge] '
if [ -d /workspace/imports ]; then
  echo 'ready: /workspace/imports'
else
  echo 'no batches yet; use ADVANCED > FILES in Android'
fi
printf '[Advanced Folder Bridge] '
if [ -d /workspace/android-in ]; then echo 'inbox initialized'; else echo 'PULL not used'; fi
printf '[Advanced Outbox] '
if [ -d /workspace/android-out ]; then echo 'outbox initialized'; else echo 'PUSH not used'; fi
printf '[Share CLI] '
if command -v aksara-share >/dev/null 2>&1; then
  echo 'aksara-share status | inbox | outbox | stage /workspace/file'
else
  echo 'not installed'
fi
printf '[Disk] '
df -h /workspace 2>/dev/null | tail -n 1 || true

check_group() {
  label="$1"
  shift
  printf '\n[%s]\n' "$label"
  for command_name in "$@"; do
    if command -v "$command_name" >/dev/null 2>&1; then
      printf '  PRESENT  %-12s %s\n' "$command_name" "$(command -v "$command_name")"
    else
      printf '  ABSENT   %s\n' "$command_name"
    fi
  done
}

check_group 'LANGUAGES AND RUNTIMES' python3 pip3 node npm go rustc cargo java javac
check_group 'COMPILERS AND BUILD' gcc g++ clang make cmake ninja lld pkg-config
check_group 'FILES AND DEBUG' git sqlite3 jq rg file find tar unzip zip less nano vim htop
check_group 'NETWORK AND SERVICES' curl wget ssh scp sftp openssl nc
check_group 'OPTIONAL MEDIA' ffmpeg ffprobe sox
check_group 'OPTIONAL MULTIPLEXER' tmux screen

printf '\n[SECURITY]\n'
echo '  Android root: NOT PROVIDED'
echo '  Android shared storage: NOT MOUNTED'
echo '  SAF files: explicit Android picker or selected folder, never a raw host mount'
echo '  No commands, packages, downloads, or privileges were changed.'
echo ''
echo 'Next: aksara-share status | aksara-doctor | apk info'
