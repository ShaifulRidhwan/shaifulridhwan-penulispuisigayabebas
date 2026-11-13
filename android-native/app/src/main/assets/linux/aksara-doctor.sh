#!/bin/sh
# Read-only diagnostics. No root, package changes, or downloads.
echo 'AKSARA LINUX · ENVIRONMENT DOCTOR'
echo '---------------------------------'
printf '[OS] '; uname -srmo 2>/dev/null || uname -a
printf '[Alpine] '; grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null || echo 'unavailable'
printf '[Workspace] '; if [ -d /workspace ]; then echo 'OK'; else echo 'MISSING'; fi
printf '[Filesystem] '; df -h /workspace 2>/dev/null | tail -n 1
printf '[Packages] '; apk --version 2>/dev/null | head -n 1
for tool in python3 git gcc g++ clang rustc go node npm java ssh cmake ninja; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '[OK] %s: %s\n' "$tool" "$(command -v "$tool")"
  else
    printf '[MISSING] %s\n' "$tool"
  fi
done
printf '[Processes]\n'; ps -o pid,comm 2>/dev/null | head -n 5 || echo 'unavailable'
printf '[Network] '; if [ -r /etc/resolv.conf ]; then echo 'DNS configured'; else echo 'DNS unavailable'; fi
printf '[Isolation] '; if [ -n "$PROOT_LOADER" ]; then echo 'PRoot environment'; else echo 'unknown'; fi
echo 'Diagnosis complete. No changes were made.'
