#!/bin/sh
# Read-only by default. Explicit localhost scan only.
set -eu
TOOLS="nmap ncat ffuf nikto.pl sqlmap openssl john hydra tshark tcpdump"
usage() {
  cat <<'HELP'
AKSARA SECURITY · Alpine ARM64 · 10 built-in pentest tools
  aksara-security --live     Show installed tools (no network scan)
  aksara-security --check    Check all ten executables
  aksara-security --report   Save /workspace/aksara-security-report.json
  aksara-security --local    TCP connect scan, localhost ports 22/80/443
For your own systems or systems you are explicitly authorized to test.
PRoot is rootless; packet capture and raw sockets may be restricted.
HELP
}
check_tools() {
  failed=0
  echo 'AKSARA SECURITY / EMBEDDED TOOL INVENTORY'
  for tool in $TOOLS; do
    if command -v "$tool" >/dev/null 2>&1; then
      printf '[PRESENT] %-12s %s\n' "$tool" "$(command -v "$tool")"
    else
      printf '[MISSING] %s\n' "$tool" >&2
      failed=1
    fi
  done
  return "$failed"
}
[ "$#" -gt 0 ] || set -- --live
case "$1" in
  --help|-h) usage ;;
  --live|--check) check_tools ;;
  --local)
    command -v nmap >/dev/null 2>&1 || { echo 'nmap unavailable' >&2; exit 1; }
    echo 'Local TCP connect scan: 127.0.0.1 (22,80,443)'
    nmap -sT -Pn -p 22,80,443 127.0.0.1 ;;
  --report)
    mkdir -p /workspace
    python3 - <<'PY'
import datetime
import json
import os
import shutil
from pathlib import Path
names = ("nmap", "ncat", "ffuf", "nikto.pl", "sqlmap",
         "openssl", "john", "hydra", "tshark", "tcpdump")
report = {
    "profile": "AKSARA Linux Security Suite / Alpine ARM64 / app-private PRoot",
    "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "android_root_available": False,
    "network_scan_performed": False,
    "tools": {name: {"installed": bool(shutil.which(name)),
                      "path": shutil.which(name)} for name in names}
}
target = Path("/workspace/aksara-security-report.json")
tmp = target.with_suffix(".tmp")
with tmp.open("w", encoding="utf-8") as handle:
    os.chmod(tmp, 0o600)
    json.dump(report, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
os.replace(tmp, target)
print(f"[REPORT] {target}")
PY
    ;;
  *) usage >&2; exit 2 ;;
esac
