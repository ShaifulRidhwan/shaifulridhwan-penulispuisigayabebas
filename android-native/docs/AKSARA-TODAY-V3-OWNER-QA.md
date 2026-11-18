# AKSARA TODAY V3 · Owner QA & Release Gate

## Scope
Reliability-first upgrade for the existing five-card Android dashboard, **without Today Signals**.
Keep the existing one-screen layout, no scrolling, fixed card order, no customizable arrangement.
Do not change Chat, Linux/PTY, Novel/Perpustakaan, or backend behavior.

## Implemented code paths
- `TodayDashboardViewModel`: Compose-observable feed/location state survives pager navigation while Android process lives.
- `TodayRefreshCoordinator`: 60-second active-only poll, cached feed TTL (weather 30m, prayers 6h, markets 15m, GitHub 10m), 30-minute location reuse.
- `TodayRepository`: cached/fresh/stale/unavailable states, cache error diagnostics, bounded location/date cache, coarse saved-location fallback, cleanup when permission withdrawn.
- JAKIM weekly schedule: validated today and next-day Subuh, never blindly substitute today's Subuh for tomorrow's.
- Local prayer fallback: optional manual JAKIM zone via prayer detail only, no login/personalization UI.
- GitHub: filter unrelated workflow conclusions before labeling Android CI; commit/CI/installed APK remain distinct.
- Weather: existing lightweight MapLibre snapshot now wired to weather's 60:40 dashboard split and native full-map detail.
- Calendar: remove Android calendar agenda and READ_CALENDAR requirement; keep local calendar/holidays.
- Crypto: one failing CoinPaprika asset need not cancel the other successful quotes.
- Details: show source, last fetch time, data freshness, and network error; no synthetic prices, charts or warnings.

## Mandatory device acceptance
1. **Install only the Full Alpine/Linux owner APK** (700–900 million bytes sanity band); verify APK package, hash, signature and actual bundled ARM64 Alpine/PRoot. Never test native 240MB preview as the Linux APK.
2. Cold-start twice, swipe Chat ↔ Today ↔ Linux ten times, lock/unlock, reopen; Chat and PTY continue to work. No Linux PTY starts prematurely just because pager precomposes an adjacent page.
3. Five Liquid Glass cards fit one screen in portrait and compact window/font-scale, without clipping or dashboard scroll. Weather card displays actual mini map (60/40) or a truthful offline placeholder. Tap mini map to open full map.
4. Pull down once: real requests may refresh; without force, repeated navigation and 60-second ticks obey per-feed TTL. Turn off network: preserved cache shows **Data lama** after a failed due fetch, not **live**.
5. Deny location: clock, BTC/ETH/SOL, GitHub work. No calendar or notification permission from initial TODAY dialog. Revoke location in Android Settings and reenter: previously saved coordinate-derived cache is purged.
6. Grant location: correct city/zone and weather. Simulate stale GPS: coarse prior location may be used up to six hours, clearly as cached; no unrestricted background tracking.
7. Open Waktu Solat: verify JAKIM zone, 5 daily times, next-day Subuh after Isyak (including month/year change); no fabricated countdown if next day unavailable. Select manual zone SGR01; verify fresh timetable; reset to automatic.
8. Open Kalendar: holidays, next holiday, Hijrah and date navigation work. **No Agenda peranti section**.
9. Crypto: if only BTC price request succeeds, it remains visible instead of all three vanishing; market detail chart uses genuine CoinGecko series.
10. GitHub: status reflects Android-related workflow, not an unrelated passing web audit. Installed APK SHA differs from current branch SHA if applicable. No false claims of verified APK.
11. Run `TodayV3ReliabilityTest`, `TodayChatV2RegressionTest`, navigation tests, Linux contracts and full Android unit tests; Android Gradle/CI green **before** owner device approval.

## Release policy
Keep PR **Draft/unmerged** until physical Android 16 owner test and explicit merge instruction.
No Today Signals, no new card, no dashboard personalisation, no Linux/Novel/Perpustakaan modifications.
