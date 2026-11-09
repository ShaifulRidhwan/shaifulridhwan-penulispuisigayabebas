# AKSARA — Eclipse Arena V2

Continues the existing Phaser combat and dedicated Android GameActivity. Chat, Voice, Studio, backend routing and authoritative combat rules are unchanged. Combat has no crouch, block or energy-cost mechanic; settings say so. Grounded attacks retain their existing movement lock. Full deflection/dead-zone analog input uses the existing full movement speed.

## Phase A: controls

`input.js` owns pointer IDs, dead zone, radial clamp, independent action pointers, keyboard state, a 160ms bounded attack queue and cancellation. `controls.js` maps DOM pointer events (Android WebView supplies stable pointer IDs per native gesture), pointer capture and coordinates in CSS viewport space. Every suspend clears all pointers, keys and queued actions. Buttons use real light/heavy/jump/special combat inputs. A second finger cannot steal an active joystick.

Defaults: joystick 100%, action buttons 100%, opacity 75%, floating and haptics enabled, dead zone 18%. Size, opacity, floating/fixed, haptics, inward action-cluster X/Y placement and graphics preferences persist in local storage at the restricted appassets origin. Reset restores defaults. Android uses origin-restricted WebMessageListener and system haptic feedback constants, throttled to at most one feedback request per 75ms, with no vibration bypass flags and no continuous stick vibration. Hardware/system settings may suppress feedback. Actual vibration feel requires a physical device.

## Phase B: assets and presentation

Original artwork was generated through the available ChatGPT image-generation tool, without paid API keys. The previously failing sprite-gen Codex OAuth route was not retried. Three source PNGs are bundled unchanged: `eclipse-warriors.png` (1774×887), `eclipse-walk.png` (2172×724), `eclipse-arena.png` (1672×941). JSON atlas metadata supplies 32 combat/idle/jump/hit/defeat poses plus 16 walking frames, with inset rectangles and foot anchors. PNG alpha and atlas bounds are checked. Source atlas and actual running browser gameplay were visually inspected. These are illustrated original Solar/Lunar fighters, replacing the geometric figures.

`visual.js` is presentation only. Idle breathing, forward/backward walking (eight frames per fighter), anticipation/ascent/fall/landing, light/heavy/special, hit/knockback, defeat and victory derive from combat state without mutating authority. Some states share drawn poses: hit/knockback share recoil; victory uses the cast pose and a celebration burst. State transitions keep the active fighter opaque and fade a prior-pose afterimage over 70ms; actual attack trails/events stay aligned to authoritative windup/active/recovery. This is pose animation, not skeletal animation or a separately drawn 15-state animation pack.

The background painting, separately cropped textured foreground (shared GPU texture), fog and environmental particles move at independent depths. Contact shadows, light arcs, heavy flashes, energy charge/bursts, solar/lunar sparks, landing dust and victory particles are bounded by a preallocated 160-particle pool. LOW reduces effects to 24 particle slots and removes fog/blur; MEDIUM uses 80; HIGH uses 160. After three measured sub-35 FPS windows the session can adapt effects down. Choosing a preset resets the adaptation. Effective quality appears in settings. No 60 FPS guarantee is claimed.

The HUD uses bundled existing DM Sans/Space Grotesk fonts and Solar/Lunar health identities, actual timer and special cooldown. There is no invented energy gauge. Native asset loading, fullscreen landscape, safe insets, gesture-edge exclusion, Canvas recovery and return-to-Chat behavior stay in the existing isolated activity.

## Verification and limits

Local deterministic suites cover combat rules, pointer ownership/cancel/release, 2/3/4 fingers, all stick/action combinations, jump+light, alternating attacks, dead zone/clamp, pause/background/resume neutrality, settings validation and animation timing/state separation. Real CDP touch events test WebGL/Canvas, independent releases, cancellation, four contacts and storage reload. Android instrumentation injects MotionEvent pointer sequences and tests window background/foreground, rotation, native Back, Portal launch and Chat draft continuity. CI also retains Studio and existing Chat/Voice regression suites.

Browser gameplay checks full-health fights to victory at 640×320 Canvas LOW, 844×390 WebGL MEDIUM and 1280×720 WebGL HIGH, with screenshots and measured frame statistics. These Cloud software-rendering results are not physical-device performance. `gameDiagnostics.performance` reports rolling FPS, p95 wall frame interval, active particle count, estimated raw RGBA texture bytes and available JS heap readings; native tests additionally record app-process PSS (not the entire WebView/GPU process tree).

Final test outcomes, screenshots, APK and measurements are supplied in delivery evidence and PR status. Do not infer a physical-device test, low-memory process-kill test, or tactile haptic validation from emulator results. The locally available emulator still cannot start within this Cloud disk capacity; API 35 CI is used for Android runtime acceptance.

## Android QA findings and corrections

The first V2 native run reached the illustrated scene but failed a short-swipe displacement check. The test now holds a drag using measured WebView/CSS coordinate ratios and verifies direction plus actual fighter movement before release. The subsequent API 35 run on `14d3c809` passed all required emulator suites, including four pointers, cancellation, background/foreground, recreation/preferences, Back and Chat continuity; native screenshots were extracted and visually inspected. Native haptic requests were accepted by the platform (this does not prove a physical vibration).

Review also found that the original navigation guard blocked the local URL used by Canvas retry. The guard now permits only the exact bundled index URL, its `renderer=canvas` variant, and the existing exit action; external navigation remains blocked. Runtime failure suspends input before displaying recovery. Settings expose a compatibility restart action. Native tests force a runtime failure and verify the retry really reloads Canvas. Frame statistics reset on explicit start/resume, avoiding paused wall time influencing adaptive quality. Native FPS/PSS snapshots use the captured `AksaraGame` log tag rather than uncollected stdout.

One CI run ended before build/web-audit jobs produced logs; the same workflows progressed normally in a fresh evaluation. No unsupported root cause is claimed. Final acceptance results and measurements are in delivery evidence and the updated PR.

Browser regression is reproducible with Playwright 1.56.1, a local server rooted at `android-native/app/src/main/assets/game` on port 8765, and `node android-native/game-tests/browser.cjs`. Optional `AKSARA_GAME_TEST_URL`, `AKSARA_GAME_EVIDENCE_DIR` and `AKSARA_PLAYWRIGHT_MODULE` select an existing server, output directory or already installed Playwright package. Deterministic tests use `node --test android-native/game-tests/*.test.cjs`. CI performs both suites and publishes gameplay screenshots/metrics.

Actual native action screenshots exposed an overly faint healthy fighter during pose crossfades. The primary sprite now stays opaque; only a bounded 25%-opacity prior-pose afterimage fades. Browser tests check readability across multiple rendered transition frames. Combat authority is unaffected.
