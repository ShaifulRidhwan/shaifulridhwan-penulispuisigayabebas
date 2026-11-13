#!/system/bin/sh
# AKSARA Linux first-run PTY. This shell only gathers consent and streams logs.
# Actual extraction is performed by Android application code after confirmation.
printf '\033]10;#E0DFDC\007\033]11;#080B12\007\033]12;#E8BF79\007'
printf '\033[38;2;232;191;121mAKSARA LINUX · FIRST INITIALIZATION\033[0m\n'
printf '%s\n' '------------------------------------'
printf '%s\n' 'Environment: Alpine Linux ARM64'
printf '%s\n' 'Mode: Rootless PRoot (bukan Android root)'
printf '%s\n' 'Status: NOT INITIALIZED'
printf '\n%s\n' 'Untuk pertama kali sahaja.'
printf '%s\n' 'Alpine dan developer tools telah tersedia dalam APK.'
printf '%s\n' 'Penyediaan akan mengekstrak fail ke storan aplikasi.'
printf '%s\n' 'Taip SETUJU untuk meneruskan.'
printf '%s\n' 'Taip BATAL untuk kembali tanpa pemasangan.'
while :; do
  printf '\033[38;2;232;191;121maksara@setup:~$ \033[0m'
  IFS= read -r REPLY || exit 0
  case "$REPLY" in
    [Ss][Ee][Tt][Uu][Jj][Uu])
      printf '%s\n' 'SETUJU' > "$AKSARA_SETUP_CONSENT"
      printf '\n%s\n' '[OK] Persetujuan diterima. Proses sebenar sedang dijalankan...'
      tail -n +1 -f "$AKSARA_SETUP_LOG" &
      LOG_PID="$!"
      while [ ! -f "$AKSARA_SETUP_DONE" ]; do sleep 1; done
      kill "$LOG_PID" 2>/dev/null || :
      cat "$AKSARA_SETUP_DONE"
      exit 0
      ;;
    [Bb][Aa][Tt][Aa][Ll])
      printf '%s\n' '[INFO] Pemasangan dibatalkan; tiada perubahan pada rootfs.'
      exit 0
      ;;
    *)
      printf '%s\n' '[!] Sila taip SETUJU atau BATAL.'
      ;;
  esac
done
