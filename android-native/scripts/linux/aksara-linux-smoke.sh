#!/bin/sh
# AKSARA Linux V3: run inside Alpine Docker/QEMU in CI and inside PRoot on phone.
# Nothing is changed outside a temporary directory.
set -eu
echo "=== AKSARA LINUX V3 SMOKE ==="
echo "Architecture: $(uname -m)"
[ "$(uname -m)" = "aarch64" ] || { echo "Expected ARM64" >&2; exit 1; }
for name in sh apk git python3 gcc g++ clang cmake node npm rustc cargo go java javac sqlite3 cloc; do
  command -v "$name" >/dev/null 2>&1 || { echo "MISSING: $name" >&2; exit 1; }
done
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
printf 'aksara\n' > "$tmp/original"
mv "$tmp/original" "$tmp/renamed"
ln -s renamed "$tmp/symlink"
[ "$(cat "$tmp/symlink")" = aksara ]
if ! ln "$tmp/renamed" "$tmp/hardlink" 2>/dev/null; then
  echo "ERROR: hardlink denied; inspect PRoot --link2symlink / PROOT_L2S_DIR" >&2
  exit 1
fi
[ "$(cat "$tmp/hardlink")" = aksara ]
cat > "$tmp/hello.c" <<'EOF_C'
#include <stdio.h>
int main(void) { puts("AKSARA_C_OK"); return 0; }
EOF_C
gcc "$tmp/hello.c" -o "$tmp/hello-gcc"
[ "$("$tmp/hello-gcc")" = AKSARA_C_OK ]
clang "$tmp/hello.c" -o "$tmp/hello-clang"
[ "$("$tmp/hello-clang")" = AKSARA_C_OK ]
cat > "$tmp/hello.cpp" <<'EOF_CPP'
#include <iostream>
int main() { std::cout << "AKSARA_CPP_OK"; }
EOF_CPP
g++ "$tmp/hello.cpp" -o "$tmp/hello-cpp"
[ "$("$tmp/hello-cpp")" = AKSARA_CPP_OK ]
python3 -c 'import sys,sqlite3; assert sys.version_info.major==3; assert sqlite3.connect(":memory:").execute("select 1").fetchone()[0]==1'
[ "$(node -e 'process.stdout.write("AKSARA_NODE_OK")')" = AKSARA_NODE_OK ]
cat > "$tmp/hello.rs" <<'EOF_RS'
fn main() { println!("AKSARA_RUST_OK"); }
EOF_RS
rustc "$tmp/hello.rs" -o "$tmp/hello-rust"
[ "$("$tmp/hello-rust")" = AKSARA_RUST_OK ]
cat > "$tmp/hello.go" <<'EOF_GO'
package main
import "fmt"
func main() { fmt.Print("AKSARA_GO_OK") }
EOF_GO
GOCACHE="$tmp/go-cache" go build -o "$tmp/hello-go" "$tmp/hello.go"
[ "$("$tmp/hello-go")" = AKSARA_GO_OK ]
[ "$(sqlite3 :memory: 'select 42;')" = 42 ]
echo "AKSARA LINUX V3: TOOLCHAIN + FILESYSTEM PASS"
if [ "${1:-}" = "--ci" ]; then
  echo "ARM64 Alpine CI passed; phone PRoot compatibility still requires device QA."
fi
