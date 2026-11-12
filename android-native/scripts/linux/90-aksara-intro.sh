# Alpine login shell startup: keep noninteractive work and inner shells silent.
case "$-" in *i*) ;; *) return 0 ;; esac
[ "$AKSARA_INTRO_OFF" = "1" ] && return 0
[ -e /root/.config/aksara/intro-off ] && return 0
[ "$AKSARA_INTRO_SHOWN" = "1" ] && return 0
AKSARA_INTRO_SHOWN=1
export AKSARA_INTRO_SHOWN
if command -v aksara-fetch >/dev/null 2>&1; then
  aksara-fetch --startup || :
fi
