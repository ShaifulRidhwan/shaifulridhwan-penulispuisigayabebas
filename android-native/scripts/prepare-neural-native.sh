#!/usr/bin/env bash
set -euo pipefail

# Audited upstream release b12248, 2026-11-10. Never build from a moving branch.
UPSTREAM_URL="https://github.com/ggml-org/llama.cpp.git"
UPSTREAM_SHA="3837bf0bc02ea5d08f8ee3585fc8c7784a81bce8"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/app/src/main/neural/third_party/llama.cpp"

if [ -e "$DEST" ] && [ ! -d "$DEST/.git" ]; then
  echo "Refusing to overwrite non-git upstream path: $DEST" >&2
  exit 1
fi
mkdir -p "$(dirname "$DEST")"
if [ ! -d "$DEST/.git" ]; then
  git clone --filter=blob:none --no-checkout "$UPSTREAM_URL" "$DEST"
fi
actual_remote="$(git -C "$DEST" remote get-url origin)"
if [ "$actual_remote" != "$UPSTREAM_URL" ]; then
  echo "Unexpected llama.cpp origin: $actual_remote" >&2
  exit 1
fi
git -C "$DEST" fetch --depth 1 origin "$UPSTREAM_SHA"
git -C "$DEST" checkout --detach --force "$UPSTREAM_SHA"
actual="$(git -C "$DEST" rev-parse HEAD)"
if [ "$actual" != "$UPSTREAM_SHA" ]; then
  echo "llama.cpp revision mismatch: $actual" >&2
  exit 1
fi
if [ ! -f "$DEST/include/llama.h" ]; then
  echo "Missing llama.cpp public API header" >&2
  exit 1
fi
printf 'llama.cpp pinned: %s\n' "$actual"
