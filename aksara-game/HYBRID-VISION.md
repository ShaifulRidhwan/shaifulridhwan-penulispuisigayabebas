# AKSARA: Between Two Eternities — Hybrid Visual Bible v0.1

## North star
A contemplative dark-fantasy exploration game. A woman with flowing dark hair and an intricate ivory-and-midnight gown walks between a radiant sun kingdom **Solara** and a moonlit gothic kingdom **Noctara**, through the balanced threshold **Antara**. Light is not automatically virtue; dark is not automatically evil.

## Scene to build
A wet engraved stone causeway through a foggy ravine, leading toward a massive celestial ring/portal. To the left: gold backlight, temples, warm blooms, ivy, sun. To the right: blue moonlight, gothic silhouettes, crystals, cliffs, water. Cinematic composition, subtle cloth motion, distant depth.

## Hybrid promise
- **Visual track:** high-end pre-rendered concept art and a consistent palette; no claims that concept art is live 3D.
- **Playable track:** Godot 4 Compatibility browser build, Android-first, third-person orbit camera and touch navigation.
- **Asset track:** import genuine licensed GLB characters and environment props at CI build time. No artistically barren primitive-only "final" releases.
- **Guardrail:** keep isolated branch and Netlify test site; never alter Bilik Antara production until mobile sign-off.

## Target quality bar
1. Character: recognizable woman, detailed face/clothes, credible silhouette, basic locomotion; replace temporary Egyptian-inspired CC0 queen with the final custom character later.
2. Environment: layered stone materials, believable vegetation, atmospheric depth, water and architecture; eliminate repeated geometric toy shapes.
3. Lighting: contrasted gold-blue realms; clear readable pathways.
4. Mobile: aim for 30 fps and progressive improvements; measure on actual Android before claiming performance.
5. Controls: left touch move, right drag camera; obvious, consistent navigation.

## Temporary CC0 assets fetched at build time
- Priestess (temporary rigged fantasy character with Idle/Walk clips): https://gobkit.com/freebies/human003/Priestess.glb ; published CC0 in https://gobkit.com/api/free . This is visibly stylized/low-poly and is NOT the final AKSARA woman.
- Oak tree replacement for the original primitive cones: https://cdn.3dassets.dev/assets/28779/v1/model.glb ; published as CC0 at https://3dassets.dev/assets/medieval-mmo-starter-realm-oak-tree-c7fbe965 .
- Sanctuary of the Seven Tones (fantasy environment): https://3dassets.dev/assets/enchanted-harp-garden-and-music-sanctuar-5f06b16f-starter-scene ; GLB https://cdn.3dassets.dev/assets/30441/v1/model.glb ; declared CC0.
- Blue Banner Castle Courtyard: https://3dassets.dev/assets/medieval-castle-construction-castle-cour-480ed575-starter-scene ; GLB https://cdn.3dassets.dev/assets/23508/v1/model.glb ; declared CC0.

### Visual rebuild v0.4
- Replaced the Egyptian-inspired Desert Queen with a rigged fantasy Priestess, because the former's clothing and crown were the wrong era.
- Changed the repeated wooden slats to a continuous world-space cracked stone shader.
- Replaced the square portal with concentric celestial rings.
- Replaced procedurally generated cone trees with CC0 oak models.
- Animated Idle and Walk clips when source GLB exports these names, subject to device verification.

### Honest stage status
The generated illustration shared in chat is **concept art, not actual gameplay**. The imported CC0 model is **not** the final bespoke AKSARA woman. Both asset import and Android frame rate must be verified in a successful build and on-device. This experiment intentionally does not promise Unreal Engine 5 graphics in a phone browser.
