# PR #327 · AKSARA TODAY V2 + Bilik Antara Chat V2

## RELEASE GATE
**DO NOT MERGE until the owner tests the new APK/UI on a physical Android phone.** Keep the PR Draft until explicit permission. Linux V4, Novel and Perpustakaan are out of scope.

## TODAY · Fixed one-screen five-card dashboard

- [ ] Swipe to Today from Chat and back 10×. No black screen, crash or Linux PTY startup.
- [ ] Five Liquid Glass cards fit without vertical scrolling, clipping or broken gaps at normal and increased Android font scale.
- [ ] Clock/date still work; existing calendar, detail windows, weather map and navigation are unchanged.
- [ ] Weather now shows a real 3-hour rain probability and temperature direction only when hourly Open-Meteo data is supplied. Older cached responses gracefully fall back to daily data.
- [ ] Open Weather detail and confirm hourly temperature chart is plotted from fetched forecast samples, with actual hourly rows and 7-day forecast below. No fake plot if unavailable.
- [ ] Prayer zone and timetable are real, and progress moves between genuine prayer intervals. Verify midnight Isyak → next-day Subuh.
- [ ] Crypto has source/fetch timestamp and explicit cache indicator; open detail and verify BTC chart fetches 24-hour CoinGecko prices, or shows unavailable without pretending to have a history.
- [ ] GitHub card and detail distinguish current branch commit/CI and installed APK identity; SHA matching is only claimed when an APK source SHA exists.
- [ ] Re-enter Dashboard repeatedly without pulling down; TTL should avoid forced fetches. Pull down once and verify it forces fresh data; failures must retain the last usable snapshot.

## CHAT · Existing visual identity + truthful state

- [ ] Keep Liquid Glass, wallpaper, three-page pager, header icons, bubbles and composer compact with no scrolling Settings home page.
- [ ] Tap Aksara A.I. identity in top bar: context panel shows session count, memory ON/OFF, summary state and selected attachments; TODAY data is not shared without consent.
- [ ] Send a message while offline, while connected and with a long NDJSON response. The lifecycle should only show actual phases: saving / context / connecting / generating / finalizing. No fabricated provider or percentage.
- [ ] Confirm Stop preserves partial text. On failure, retry uses a fresh branch and does not double-submit. Verify attachment retry correctly refuses expired receipts.
- [ ] Long history: manually scroll up and verify auto-follow stops. Floating 'Ke mesej terkini' appears and returns to latest without jumpy keyboard animations.
- [ ] Two completed answers from different providers: tap Butiran on each and verify the selected answer's provider/model/tools/evidence, not the last answer's data. Old imported messages may show 'Tidak dilaporkan'.
- [ ] Force close/reopen the app: encrypted history retains the per-answer metadata for newly created answers; legacy archives still open.
- [ ] Run attachment picker/large-file consent, Voice Live, Settings, Search Hub, branch/edit/regenerate. All existing flows must still work.

## Regression and safety

- [ ] Kotlin JVM unit tests, Android Native CI, performance contracts and other PR checks green.
- [ ] CI diff contains no edits to core/linux, Novel, Perpustakaan, chess, game or backend.
- [ ] Memory remains OFF by default; no new automatic personalisation or cross-page data sharing.
- [ ] User visually signs off after testing the actual latest APK. Do not infer Android runtime success from green CI alone.
