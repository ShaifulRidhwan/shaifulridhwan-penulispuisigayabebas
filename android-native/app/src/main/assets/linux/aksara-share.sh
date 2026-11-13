#!/bin/sh
# AKSARA Advanced Mode: guest workspace helper. Android SAF PUSH is user-triggered.
set -eu

usage() {
  cat <<'END'
AKSARA LINUX / ADVANCED MODE
  aksara-share status               Show bridge directories
  aksara-share inbox                List received batches
  aksara-share outbox               List files awaiting PUSH
  aksara-share stage /workspace/x   Copy file into outbox

Stage does not export files automatically. Tap ADVANCED > PUSH in Android.
PULL stores user-selected folder documents in /workspace/android-in/batch-*
PUSH copies /workspace/android-out files into selected Android folder.
The Android folder is never mounted directly into Alpine.
END
}

outbox=/workspace/android-out
[ "$#" -gt 0 ] || { usage; exit 0; }
case "$1" in
  help|--help|-h) usage ;;
  status)
    printf '[Bridge] Android SAF permission required for PULL/PUSH\n'
    for path in /workspace/imports /workspace/android-in /workspace/android-out; do
      if [ -d "$path" ]; then
        printf '[READY] %s\n' "$path"
      else
        printf '[EMPTY] %s\n' "$path"
      fi
    done ;;
  inbox)
    for path in /workspace/imports /workspace/android-in; do
      printf '\n%s\n' "$path"
      if [ -d "$path" ]; then ls -lah "$path"; else echo '(empty)'; fi
    done ;;
  outbox)
    mkdir -p "$outbox"
    ls -lah "$outbox" ;;
  stage)
    [ "$#" -eq 2 ] || { usage >&2; exit 2; }
    source="$2"
    [ -f "$source" ] && [ ! -L "$source" ] || {
      echo 'ERROR: ordinary file required, not a symlink/directory' >&2
      exit 2
    }
    resolved="$(realpath "$source")" || exit 2
    case "$resolved" in
      /workspace/*) ;;
      *) echo 'ERROR: only files inside /workspace are allowed' >&2; exit 2 ;;
    esac
    name="$(basename "$source")"
    case "$name" in
      .*|id_rsa|id_ed25519|id_ecdsa|*.pem|*.p12|*.key|*credentials*)
        echo 'ERROR: private-looking files are not staged' >&2
        exit 2 ;;
    esac
    bytes="$(wc -c < "$source")"
    [ "$bytes" -le 268435456 ] || {
      echo 'ERROR: file exceeds 256 MiB limit' >&2
      exit 2
    }
    mkdir -p "$outbox"
    dest="$outbox/$name"
    [ ! -e "$dest" ] && [ ! -L "$dest" ] || {
      echo 'ERROR: filename already exists in outbox; rename explicitly' >&2
      exit 2
    }
    ( umask 077; set -C; cat "$source" > "$dest" ) || {
      echo 'ERROR: staging failed' >&2
      exit 1
    }
    printf '[STAGED] %s -> %s\n' "$source" "$dest"
    echo 'Tap ADVANCED > PUSH to export it to Android.'
    ;;
  *) usage >&2; exit 2 ;;
esac
