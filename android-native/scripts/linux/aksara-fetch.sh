#!/bin/sh
# AKSARA Linux System Identity. Real fastfetch metrics, no remote calls or daemon.
# A new real PTY shows this once; manual "aksara-fetch" always works.
case "$1" in
  ""|--startup|--show) ;;
  --help) printf '%s\n' 'Usage: aksara-fetch [--show|--startup|--help]' 'Disable automatic splash: export AKSARA_INTRO_OFF=1'; exit 0 ;;
  *) printf '%s\n' 'Unknown aksara-fetch option' >&2; exit 2 ;;
esac
[ -t 1 ] || exit 0
gold='\033[1;38;2;230;197;139m'
blue='\033[1;38;2;118;194;248m'
dim='\033[38;2;128;155;182m'
reset='\033[0m'
cols=80
if [ -r /dev/tty ]; then
  set -- $(stty size < /dev/tty 2>/dev/null)
  case "$2" in ""|*[!0-9]*) ;; *) [ "$2" -gt 0 ] && cols="$2" ;; esac
fi
if [ "$AKSARA_INTRO_COMPACT" = "1" ] || [ "$cols" -lt 76 ]; then
  config=/usr/share/aksara/fastfetch-compact.jsonc
  printf '\n%b╭━━━ ◆ A K S A R A ◆ ━━━╮%b\n' "$gold" "$reset"
  printf '%b┃  L I N U X   I D     ┃%b\n' "$blue" "$reset"
  printf '%b╰━━━━━━━━━━━━━━━━━━━━━━━╯%b\n' "$gold" "$reset"
else
  config=/usr/share/aksara/fastfetch-wide.jsonc
  printf '\n%b╭━━━━━━━━━━━━━━━━━━━%b◆%b━━━━━━━━━━━━━━━━━━━━╮%b\n' "$gold" "$blue" "$gold" "$reset"
  printf '%b│%b  A K S A R A  /  S Y S T E M  I D E N T I T Y  %b│%b\n' "$gold" "$blue" "$gold" "$reset"
  printf '%b╰━━━━━━━━━━━━━━━━━━━%b◆%b━━━━━━━━━━━━━━━━━━━━╯%b\n' "$gold" "$blue" "$gold" "$reset"
fi
if command -v fastfetch >/dev/null 2>&1; then
  if ! timeout 4 fastfetch --config "$config" 2>/dev/null; then
    printf '%bAlpine userland · Android host · ARM64 / PRoot%b\n' "$blue" "$reset"
  fi
else
  printf '%bAlpine userland · Android host · ARM64 / PRoot%b\n' "$blue" "$reset"
fi
printf '%b' "$dim"
printf '%s' '  ▬▬'
printf '%b' "$gold"
printf '%s' '▬▬'
printf '%b' "$blue"
printf '%s' '▬▬'
printf '%b' "$reset"
printf '%s\n' '  ROOTLESS  ·  /workspace'
