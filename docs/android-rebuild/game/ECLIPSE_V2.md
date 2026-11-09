# AKSARA — Eclipse Arena V2

Continues the existing Phaser combat and dedicated Android GameActivity. Chat, Voice, Studio, backend routing and authoritative combat rules are unchanged. Combat has no crouch, block or energy-cost mechanic; settings say so. Grounded attacks retain their existing movement lock. Full deflection/dead-zone analog input uses the existing full movement speed.

## Phase A: controls

`input.js` owns pointer IDs, dead zone, radial clamp, independent action pointers, keyboard state, a 160ms bounded attack queue and cancellation. `controls.js` maps DOM pointer events (Android WebView supplies stable pointer IDs per native gesture), pointer capture and coordinates in CSS viewport space. Every suspend clears all pointers, keys and queued actions. Buttons use real light/heavy/jump/special combat inputs. A second finger cannot steal an active joystick.

Defaults: joystick 100%, action buttons 100%, opacity 75%, floating and haptics enabled, dead zone 18%. Size, opacity, floating/fixed, haptics, inward action-cluster X/Y placement and graphics preferences persist in local storage at the restricted appassets origin. Reset restores defaults. Android uses origin-restricted WebMessageListener and system haptic feedback constants, throttled to at most one feedback request per 75ms, with no vibration bypass flags and no continuous stick vibration. Hardware/system settings may suppress feedback. Actual vibration feel requires a physical device.

## Phase B: assets and presentation

Original artwork was generated through the available ChatGPT image-generation tool, without paid API keys. The previously failing sprite-gen Codex OAuth route was not retried. Three source PNGs are bundled unchanged: `eclipse-warriors.png` (1774×887), `eclipse-walk.png` (2172×724), `eclipse-arena.png` (1672×941). JSON atlas metadata supplies 32 combat/idle/jump/hit/defeat poses plus 16 walking frames, with inset rectangles and foot anchors. PNG alpha and atlas bounds are checked. Source atlas and actual running browser gameplay were visually inspected. These are illustrated original Solar/Lunar fighters, replacing the geometric figures.

`visual.js` is presentation only. Idle breathing, forward/backward walking (eight frames per fighter), anticipation/ascent/fall/landing, light/heavy/special, hit/knockback, defeat and victory derive from combat state without mutating authority. Some states share drawn poses: hit/knockback share recoil; victory uses the cast pose and a celebration burst. State transitions crossfade over 70ms; actual attack trails/events stay aligned to authoritative windup/active/recovery. This is pose animation, not skeletal animation or a separately drawn 15-state animation pack.

The background painting, separately cropped textured foreground (shared GPU texture), fog and environmental particles move at independent depths. Contact shadows, light arcs, heavy flashes, energy charge/bursts, solar/lunar sparks, landing dust and victory particles are bounded by a preallocated 160-particle pool. LOW reduces effects to 24 particle slots and removes fog/blur; MEDIUM uses 80; HIGH uses 160. After three measured sub-35 FPS windows the session can adapt effects down. Choosing a preset resets the adaptation. Effective quality appears in settings. No 60 FPS guarantee is claimed.

The HUD uses bundled existing DM Sans/Space Grotesk fonts and Solar/Lunar health identities, actual timer and special cooldown. There is no invented energy gauge. Native asset loading, fullscreen landscape, safe insets, gesture-edge exclusion, Canvas recovery and return-to-Chat behavior stay in the existing isolated activity.

## Verification and limits

Local deterministic suites cover combat rules, pointer ownership/cancel/release, 2/3/4 fingers, all stick/action combinations, jump+light, alternating attacks, dead zone/clamp, pause/background/resume neutrality, settings validation and animation timing/state separation. Real CDP touch events test WebGL/Canvas, independent releases, cancellation, four contacts and storage reload. Android instrumentation injects MotionEvent pointer sequences and tests window background/foreground, rotation, native Back, Portal launch and Chat draft continuity. CI also retains Studio and existing Chat/Voice regression suites.

Browser gameplay checks full-health fights to victory at 640×320 Canvas LOW, 844×390 WebGL MEDIUM and 1280×720 WebGL HIGH, with screenshots and measured frame statistics. These Cloud software-rendering results are not physical-device performance. `gameDiagnostics.performance` reports rolling FPS, p95 wall frame interval, active particle count, estimated raw RGBA texture bytes and available JS heap readings; native tests additionally record app-process PSS (not the entire WebView/GPU process tree).

Final test outcomes, screenshots, APK and measurements are supplied in delivery evidence and PR status. Do not infer a physical-device test, low-memory process-kill test, or tactile haptic validation from emulator results. The locally available emulator still cannot start within this Cloud disk capacity; API 35 CI is used for Android runtime acceptance.
