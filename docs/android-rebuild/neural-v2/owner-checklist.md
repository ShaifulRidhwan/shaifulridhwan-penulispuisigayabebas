# PR #321 owner testing

Install the final release's `.apk` on an ARM64 Android 12+ phone. Downloading the
Actions artifact gives a ZIP: extract the APK before installing. Allow this file
source in Android's install settings. The preview package is scoped to PR #321
and its commit, so it can coexist with an app signed by an older CI keystore.
Check the APK against `SHA256SUMS` and retain the Stockfish source companion when
redistributing. No model weights are included in the APK.

1. From Bilik Antara swipe left to Neural; swipe right to Today. Return with Bilik.
   Check all six entry points fit in portrait and landscape. Compare the wallpaper,
   headings and glass with Chat/Today. Check enlarged system fonts on the phone.
2. Inspect Device Intelligence: RAM, storage, ABI, Android and thermal values.
   Advanced must be rejected on an 8 GB device; use Light first.
3. In Model Library manually download Light, cancel, retry, and let it complete.
   Check real byte progress and successful SHA-256 installation. Try importing the
   exact same catalog GGUF, then a truncated/modified file (must fail).
4. Activate Light, enable airplane mode, open Live Inference and ask a Malay
   question. Check incremental generation, Stop, another turn, four-turn context,
   long-context rejection, keyboard, scroll position and conversation clearing.
   No cloud provider should be contacted or silently selected.
5. Switch models only when idle. Unload and reload, then background the app during
   generation/download. On return the model must be unloaded; interrupted downloads
   restart from zero. Kill/restart the app: installed files persist, chat does not.
6. Run the nine laboratory prompts once if desired. Inspect genuine output, load
   time, TTFT, token count/speed, duration, PSS and thermal state. These are timing
   measurements, not automatic correctness scores. Review answer quality manually.
7. Query Knowledge & Reasoning with an Aksara identity/project question. Inspect
   attributed retrieved facts; try an unknown question and check the missing-source
   state. Long-term memory remains OFF.
8. Confirm Bilik multi-provider chat, Live Voice, Studio, Today, chess/Ratu Gelap,
   Explore, Settings, history, sessions, Novel/Library and poetry still operate.

Host JNI verification does not replace physical-device inference, GPU/thermal
behavior, visual parity or regression testing. Balanced/Advanced quality and full
8B performance are reserved for the owner's compatible phone. Debug signing is
for owner testing, not a production-store release. Do not merge before owner QA.
