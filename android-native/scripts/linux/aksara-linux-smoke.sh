#!/bin/sh
# AKSARA Linux V3: ARM64 QEMU CI and Android PRoot diagnostic smoke.
# Explicit stages distinguish slow compilation from a stalled process.
set -eu
stage="Bootstrap"
tmp=""
cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    printf '\n[FAIL] %s (exit %s)\n' "$stage" "$status" >&2
  fi
  if [ -n "$tmp" ]; then rm -rf "$tmp"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
announce() {
  stage="$2"
  printf '\n[%s/10] %s\n' "$1" "$stage"
}
echo "=== AKSARA LINUX V3 SMOKE ==="
announce 01 "Architecture"
arch="$(uname -m)"
echo "Architecture: $arch"
[ "$arch" = "aarch64" ] || { echo "Expected ARM64 guest" >&2; exit 1; }
announce 02 "Checking bundled commands"
for name in sh apk git python3 gcc g++ clang cmake node npm rustc cargo go java javac sqlite3 cloc; do
  command -v "$name" >/dev/null 2>&1 || { echo "MISSING: $name" >&2; exit 1; }
done
echo "[PASS] Bundled tools: 17 commands"
announce 03 "Temporary directory, rename, symlink and hardlink"
tmp="$(mktemp -d)"
printf 'aksara\n' > "$tmp/original"
mv "$tmp/original" "$tmp/renamed"
ln -s renamed "$tmp/symlink"
[ "$(cat "$tmp/symlink")" = aksara ]
if ! ln "$tmp/renamed" "$tmp/hardlink" 2>/dev/null; then
  echo "HARDLINK DENIED: inspect --link2symlink and PROOT_L2S_DIR" >&2
  exit 1
fi
[ "$(cat "$tmp/hardlink")" = aksara ]
echo "[PASS] Filesystem operations"
cat > "$tmp/hello.c" <<'EOF_C'
#include <stdio.h>
int main(void) { puts("AKSARA_C_OK"); return 0; }
EOF_C
announce 04 "GCC: compiling and executing C"
gcc "$tmp/hello.c" -o "$tmp/hello-gcc"
[ "$("$tmp/hello-gcc")" = AKSARA_C_OK ]
echo "[PASS] GCC"
announce 05 "Clang: compiling and executing C"
clang "$tmp/hello.c" -o "$tmp/hello-clang"
[ "$("$tmp/hello-clang")" = AKSARA_C_OK ]
echo "[PASS] Clang"
announce 06 "G++: compiling and executing C++"
cat > "$tmp/hello.cpp" <<'EOF_CPP'
#include <iostream>
int main() { std::cout << "AKSARA_CPP_OK"; }
EOF_CPP
g++ "$tmp/hello.cpp" -o "$tmp/hello-cpp"
[ "$("$tmp/hello-cpp")" = AKSARA_CPP_OK ]
echo "[PASS] G++"
announce 07 "Python: interpreter and SQLite module"
python3 -c 'import sys,sqlite3; assert sys.version_info.major==3; assert sqlite3.connect(":memory:").execute("select 1").fetchone()[0]==1'
echo "[PASS] Python + sqlite3"
announce 08 "Node.js: executing JavaScript"
[ "$(node -e 'process.stdout.write("AKSARA_NODE_OK")')" = AKSARA_NODE_OK ]
echo "[PASS] Node.js"
announce 09 "Rust: compiling and executing binary"
cat > "$tmp/hello.rs" <<'EOF_RS'
fn main() { println!("AKSARA_RUST_OK"); }
EOF_RS
rustc "$tmp/hello.rs" -o "$tmp/hello-rust"
[ "$("$tmp/hello-rust")" = AKSARA_RUST_OK ]
echo "[PASS] Rust"
announce 10 "Go and SQLite CLI: compile-and-run"
cat > "$tmp/hello.go" <<'EOF_GO'
package main
import "fmt"
func main() { fmt.Print("AKSARA_GO_OK") }
EOF_GO
GOCACHE="$tmp/go-cache" go build -o "$tmp/hello-go" "$tmp/hello.go"
[ "$("$tmp/hello-go")" = AKSARA_GO_OK ]
[ "$(sqlite3 :memory: 'select 42;')" = 42 ]
echo "[PASS] Go + SQLite CLI"
echo ""
echo "AKSARA LINUX V3: TOOLCHAIN + FILESYSTEM PASS"
if [ "$#" -gt 0 ] && [ "$1" = "--ci" ]; then
  echo "ARM64 QEMU CI passed; Android PRoot device QA still required."
fi
