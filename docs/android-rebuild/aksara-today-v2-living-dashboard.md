# AKSARA TODAY V2 — Living Dashboard (Implementation Contract)

Status: work in progress. NO MERGE prior to CI green, device review and user acceptance.

## Design invariant
- The current dark Liquid Glass background, typography, initial Chat page, swipe to TODAY, jam, solat, crypto, GitHub cards remain intact.
- ONLY Cuaca & Lokasi becomes a 60:40 two-cube section (cuaca left and preview peta right) without reshuffling the five groups.
- One tap per card opens native Glass detail; close/back returns to TODAY without touching Chat, Voice, Studio, Novel/Perpustakaan/Puisi, games or the Netlify web deploy.
- Modal surfaces retain common gold outline, dark tint, radius, typography and accessibility semantics.
- Feature data loads lazily while the window is open. Cache and graceful offline states are mandatory.

## Six windows
1. **Masa**: date, time, monthly calendar, Hijri info (from known prayer data when available), local calendar events only with explicit READ_CALENDAR permission and user-initiated request.
2. **Cuaca**: live hourly and 7-day forecasts and clear source/update labels via Open-Meteo; no invented METMalaysia alerts.
3. **Lokasi**: Mini-map snapshot in a 40% cube; full screen MapLibre Native / OpenFreeMap Dark; GPS recenter and attribution. External navigation handoff available as a safe first routing step, not false claim of Waze live traffic or proprietary turn-by-turn.
4. **Solat**: today timetable and monthly data (solat.my/e-Solat JAKIM), plus a small set of editorial, sourced, non-AI-generated reminders; NOT fabricated hadith.
5. **Kripto**: expanded market list, searchable coins, price/24h change and SC Malaysia Digital Assets Shariah status only for explicitly confirmed tokens. Unknown stays 'Belum disahkan'; never imply every mode of trading is halal.
6. **Pembangunan**: exact commit history of the Android development branch plus GitHub releases and Bilik Antara/web history where verifiable; separate SHA, CI, APK release from claims of publication.

## Data sources / constraints
- OpenFreeMap dark vector tiles, MapLibre native OpenGL, attribution per OpenFreeMap and OSM; no API keys, no paid billing, no bulk download. Tile service has no SLA.
- Open-Meteo non-commercial / fair-use; no extra provider calls until user opens detail.
- solat.my public prayer API sourced from JAKIM, honor cache.
- SC Malaysia Digital Assets webpage official per-asset Shariah classifications; status MUST be source-backed, not guessed, reflect date of research.
- CoinPaprika public market prices; no transactions.
- GitHub public API with rate limit fallback, strong latest commit SHA evidence.
- Avoid public Nominatim autocomplete and shared OSRM demo production routing. Routing beyond external app handoff needs a licensed provider or own server and is not represented as implemented.

## Acceptance
- Gradle assembleDebug + TodayParsersTest and new tests; backend smoke; no new security/permission regression.
- 360/390/412 dp test, denied/revoked permission, airplane-mode, rapid taps, background/foreground and back handling.
- no silent map subscriptions, no paid SDK plans, no new secret keys bundled, no Netlify auto deploy.
- User tests PR APK; touch up; merge only after explicit acceptance.
