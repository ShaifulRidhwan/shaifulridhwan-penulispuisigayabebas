#!/bin/sh
# AKSARA Obsidian · Gold & Crimson. Only shell visuals.
case "$-" in *i*) ;; *) return 0 ;; esac
printf '\033]10;#E0DFDC\007\033]11;#080B12\007\033]12;#E8BF79\007'
printf '\033]4;1;#CE5962\007\033]4;3;#E8BF79\007'
[ "$AKSARA_PROMPT_OFF" = "1" ] && return 0
AKSARA_GOLD="$(printf '\033[38;2;232;191;121m')"
AKSARA_RESET="$(printf '\033[0m')"
PS1="$AKSARA_GOLD"'aksara@alpine:\w\$ '"$AKSARA_RESET"
export PS1
