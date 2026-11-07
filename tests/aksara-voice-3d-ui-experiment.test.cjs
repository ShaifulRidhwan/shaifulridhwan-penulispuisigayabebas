"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("V4.5 is the default presentation; classic rollback leaves native Voice engine intact",()=>{
 const html=read("bilik-antara.html");
 const js=read("bilik-antara-voice-experiment-v3.js");
 assert.match(html,/const mode=new URLSearchParams\(location.search\)\.get\("voice-ui"\)/);
 assert.match(html,/if\(mode==="classic"\)return/);
 assert.doesNotMatch(html,/get\("voice-ui"\)!=="3d"\)return/);
 assert.match(html,/DOMContentLoaded/);
 assert.match(html,/sheet\.onload=\(\)=>/);
 assert.match(html,/sheet\.onerror=\(\)=>/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=12/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.doesNotMatch(html,/<link[^>]+href="bilik-antara-voice-experiment-v3\.css/);
 assert.match(js,/get\("voice-preview"\)==="1"/);
 assert.doesNotMatch(js,/get\("voice-live"\)!=="1"/);
 const voice=read("bilik-antara-voice.js");
 assert.match(html,/bilik-antara-voice\.js\?v=51/);
 assert.match(voice,/const LIVE_LOCKED_VOICE="Aoede"/);
 assert.match(voice,/START_SENSITIVITY_HIGH/);
});

test("experiment only rearranges original voice DOM elements",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const html=read("bilik-antara.html");
 for(const id of ["voicePanel","voiceAvatarStage","voiceMuteMic","voiceMuteSpeaker","voiceVolume","voiceStop","voicePhaseLabel","voiceStatus","voiceDialectSelect"]){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const id of ["voicePanel","voiceAvatarStage","voiceMuteSpeaker","voiceStop","voiceStyleTrigger","voiceModeBadge"]){
   assert.ok(script.includes('"'+id+'"'),id+" is reused");
 }
 assert.match(script,/footerEnd\.addEventListener\("click",\(\)=>stop\.click\(\)\)/);
 assert.doesNotMatch(script,/new WebSocket|new AudioContext|\.getUserMedia\(|fetch\(|localStorage\.setItem|sessionStorage\.setItem/);
});

test("3D avatar and original voice engine remain in place",()=>{
 const html=read("bilik-antara.html");
 const avatar=read("bilik-antara-avatar.js");
 const voice=read("bilik-antara-voice.js");
 assert.match(html,/import\("\.\/bilik-antara-avatar\.js\?v=15"\)/);
 assert.match(avatar,/brunette\.glb/);
 assert.match(avatar,/voiceAvatarStage/);
 assert.match(voice,/const LIVE_LOCKED_VOICE="Aoede"/);
 assert.match(voice,/let voiceVolume=0\.5/);
 assert.match(voice,/window\.BilikAntaraVoiceDiagnostics/);
});

test("responsive design, screen-reader labels and reduced-motion are preserved",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const script=read("bilik-antara-voice-experiment-v3.js");
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.voice-avatar-stage/);
 assert.match(script,/setAttribute\("aria-label","Kawalan sesi suara"\)/);
 assert.match(script,/const connected=active&&d\?\.connected===true/);
 assert.match(script,/panel\.dataset\.voicePhase/);
});
test("voice UI uses Bilik Antara gold-blue glass and no emoji pseudo-icons",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const js=read("bilik-antara-voice-experiment-v3.js");
 assert.match(css,/#e1b86d/);
 assert.match(css,/#voiceMuteMic::before/);
 assert.match(css,/#voiceMuteSpeaker::before/);
 assert.match(css,/mask-image:url\(/);
 assert.doesNotMatch(css,/[🎙♫☎]/u);
 assert.doesNotMatch(js,/Wajah 3D asal/);
 assert.match(css,/#voiceObserveV2\{display:none!important\}/);
});

test("v3.2 inherits the actual Bilik Antara glass and font tokens",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const base=read("bilik-antara.css");
 assert.match(base,/--gold:#e1b86d/);
 assert.match(css,/--voice-gold:var\(--gold/);
 assert.match(css,/--voice-ink:var\(--ink/);
 assert.match(css,/--voice-glass:linear-gradient\(150deg,rgba\(23,31,45/);
 assert.match(css,/"DM Sans"/);
 assert.match(css,/"Space Grotesk"/);
 assert.match(css,/\.voice-live-label::before\{\s*content:none!important/);
 assert.match(css,/backdrop-filter:blur\(18px\)/);
});
test("same-size vector controls and stable mic / hangup / speaker order",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(script,/if\(mic\)controls\.append\(mic\);[\s\S]*controls\.append\(footerEnd\);[\s\S]*if\(speaker\)controls\.append\(speaker\);/);
 assert.match(css,/grid-template-columns:repeat\(3,60px\)/);
 assert.match(css,/place-items:center!important/);
 assert.match(css,/\.voice-x-end::before/);
 assert.match(css,/#voiceMuteMic::before/);
 assert.match(css,/#voiceMuteSpeaker::before/);
 assert.match(css,/stroke-width%3D/);
 assert.doesNotMatch(css,/[🎙♫☎]/u);
});
test("existing avatar is never replaced; fallback disappears once WebGL is ready",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(script,/bilik-antara-chat-portrait\.png\?v=1/);
 assert.match(script,/stage\.append\(fallback\)/);
 assert.match(css,/\.voice-avatar-stage\.avatar-ready \.voice-x-avatar-fallback/);
 assert.match(css,/opacity:0;visibility:hidden/);
 assert.doesNotMatch(script,/import\("three"/);
});
test("the in-call diagnostic panel does not occupy the interface",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(js,/diagnostics\.hidden=true/);
 assert.match(css,/#voiceObserveV2\{display:none!important\}/);
 assert.match(js,/BilikAntaraVoiceDiagnostics\?\.snapshot/);
});

test("v4 brand header is native Aksara and never retains old identity pill",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(js,/voice-v4-brand/);
 assert.doesNotMatch(js,/voice-v4-brand-mark/);
 assert.match(js,/AKSARA/);
 assert.match(js,/VOICE CHAT/);
 assert.match(css,/\.voice-v4-original-identity\{display:none!important\}/);
 assert.match(css,/\.voice-v4-wordmark strong/);
 assert.match(css,/\.voice-v4-wordmark small/);
});
test("v4 mobile scene is immersive and settings share one soft glass rhythm",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(css,/AKSARA VOICE V4/);
 assert.match(css,/--voice-v4-fg:var\(--ink/);
 assert.match(css,/--voice-v4-warm:var\(--gold/);
 assert.match(css,/--voice-v4-glass:linear-gradient/);
 assert.match(css,/\.voice-v4-hero::before/);
 assert.match(css,/\.voice-v4-hero::after/);
 assert.match(css,/\.voice-x-avatar-fallback/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/#voicePanel\.voice-ui-experiment-v3\[hidden\]\{display:none!important\}/);
 assert.match(css,/grid-template-columns:repeat\(3,56px\)/);
});
test("v4 retains original endpoints and audio handlers, with no new network calls",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const voice=read("bilik-antara-voice.js");
 const html=read("bilik-antara.html");
 assert.match(js,/footerEnd\.addEventListener\("click",\(\)=>stop\.click\(\)\)/);
 assert.match(js,/if\(mic\)controls\.append\(mic\)/);
 assert.match(js,/if\(speaker\)controls\.append\(speaker\)/);
 assert.match(js,/const diagnostics=panel\.querySelector\("#voiceObserveV2"\)/);
 assert.match(js,/panel\.dataset\.voiceV4Connected/);
 assert.doesNotMatch(js,/getUserMedia|new WebSocket|new AudioContext|\.netlify\/functions|fetch\(/);
 assert.match(voice,/const LIVE_LOCKED_VOICE="Aoede"/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=12/);
});

test("UI preview click is connected to the real Voice Chat entry without a Live token",()=>{
 const s=read("bilik-antara-voice-experiment-v3.js");
 assert.match(s,/const liveButton=document\.getElementById\("voiceLive"\)/);
 assert.match(s,/liveButton\.addEventListener\("click",openPreview,\{capture:true\}\)/);
 assert.match(s,/event\.stopImmediatePropagation\(\)/);
 assert.match(s,/panel\.hidden=false/);
 assert.match(s,/liveText\.textContent="PRATONTON UI"/);
 assert.match(s,/previewStatus="Pratonton reka bentuk sahaja/);
 assert.match(s,/stop\.addEventListener\("click"/);
 assert.match(s,/panel\.hidden=true/);
 assert.match(s,/voice-preview"\)==="1"/);
});
test("v4.1 follows original Bilik Antara frosted glass, curves and real compact icons",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 const html=read("bilik-antara.html");
 assert.doesNotMatch(js,/const mark=el\(/);
 assert.match(js,/brand\.append\(wordmark\)/);
 assert.match(css,/V4\.1 · visual parity with Bilik Antara/);
 assert.match(css,/--voice-curve-card:22px/);
 assert.match(css,/--voice-glass-border:rgba\(236,207,161,.24\)/);
 assert.match(css,/backdrop-filter:blur\(24px\)/);
 assert.match(css,/background:linear-gradient\(145deg,rgba\(229,198,153,.07\)/);
 assert.match(css,/grid-template-columns:repeat\(3,58px\)/);
 assert.match(css,/grid-template-columns:repeat\(3,56px\)/);
 assert.match(css,/grid-template-columns:repeat\(3,52px\)/);
 assert.match(css,/M3\.1%207\.9/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=12/);
});

test("v4.2 has one equal optical SVG family and fixed control grid",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(css,/Voice V4\.2: one icon family/);
 assert.match(css,/grid-template-columns:repeat\(3,var\(--voice-control-size,58px\)\)/);
 assert.match(css,/top:50%!important;left:50%!important/);
 assert.match(css,/transform:translate\(-50%,-50%\)!important/);
 assert.match(css,/width:27px!important;height:27px!important/);
 assert.match(css,/--voice-control-size:56px/);
 assert.match(css,/--voice-control-size:52px/);
 assert.match(css,/M3\.3%209\.1/);
});

test("V4.2 hangup icon overrides legacy selector with exact 27px glyph",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(css,/button\.voice-x-end::before\{\s*width:27px!important;height:27px!important/);
});
test("v4.3 cinematic framing, status waveform, quiet panels and accessible end call",()=>{
 const avatar=read("bilik-antara-avatar.js");
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 const html=read("bilik-antara.html");
 assert.match(avatar,/panel\.classList\.contains\("voice-ui-experiment-v3"\)/);
 assert.match(avatar,/Math\.max\(\.75,distance\)\*1\.07/);
 assert.match(avatar,/:\s*Math\.max\(\.75,distance\)/);
 assert.match(js,/dock\.insertBefore\(wave,dock\.firstChild\)/);
 assert.doesNotMatch(js,/if\(wave\)hero\.append\(wave\)/);
 assert.match(css,/V4\.3 cinematic final-pass/);
 assert.match(css,/\.voice-x-avatar-fallback\{\s*transform:scale\(\.935\)!important/);
 assert.match(css,/\.voice-dialogue-dock \.voice-wave\{/);
 assert.match(css,/rgba\(231,197,149,.13\)/);
 assert.match(css,/button\.voice-x-end\{\s*background:linear-gradient\(145deg,rgba\(180,71,78,.90\)/);
 assert.match(html,/bilik-antara-avatar\.js\?v=15/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=12/);
});

test("V4.3 red end-call wins over base liquid-glass :is specificity without modifying production styles",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(css,/#voicePanel#voicePanel\.voice-ui-experiment-v3 \.voice-v4-control-deck \.voice-session-controls>button\.voice-x-end\{/);
 assert.match(css,/background:linear-gradient\(145deg,rgba\(180,71,78,.90\)/);
});

test("v4.4 uses Bilik Antara glass for brand, circular X and dialect dialog with rounded options",()=>{
 const html=read("bilik-antara.html");
 const css=read("bilik-antara-voice-experiment-v3.css");
 const js=read("bilik-antara-voice-experiment-v3.js");
 assert.match(js,/voice-x-setting-label","Volume"/);
 assert.doesNotMatch(js,/voice-x-setting-label","Kelantangan"/);
 assert.match(css,/AKSARA VOICE V4\.4/);
 assert.match(css,/#voicePanel\.voice-ui-experiment-v3 \.voice-v4-brand\{/);
 assert.match(css,/border-radius:17px!important/);
 assert.match(css,/#voicePanel#voicePanel\.voice-ui-experiment-v3 \.voice-panel-head-actions #voiceStop\{/);
 assert.match(css,/border-radius:50%!important/);
 assert.match(css,/body\.aksara-voice-3d-experiment \.aksara-voice-style-dialog\{/);
 assert.match(css,/border-radius:29px!important/);
 assert.match(css,/backdrop-filter:blur\(28px\) saturate\(1\.22\)/);
 assert.match(css,/body\.aksara-voice-3d-experiment \.aksara-voice-style-dialog::backdrop/);
 assert.match(css,/\.voice-style-option\.is-selected/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=12/);
});

test("v4.4 scoped polish reaches the real body-mounted dialect dialog, X and glass identity",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const html=read("bilik-antara.html");
 const js=read("bilik-antara-voice-experiment-v3.js");
 assert.match(js,/voice-x-setting-label","Volume"/);
 assert.match(css,/AKSARA Voice V4\.4 · liquid-glass refinement/);
 assert.match(css,/#voicePanel#voicePanel\.voice-ui-experiment-v3 \.voice-panel-head \.voice-v4-brand\{/);
 assert.match(css,/#voicePanel#voicePanel\.voice-ui-experiment-v3 \.voice-panel-head-actions #voiceStop\{/);
 assert.match(css,/#voicePanel#voicePanel\.voice-ui-experiment-v3 \.voice-panel-head-actions #voiceStop::before\{/);
 assert.match(css,/border-radius:50%!important/);
 assert.match(css,/body\.aksara-voice-3d-experiment dialog#voiceStyleDialog\.aksara-voice-style-dialog\{/);
 assert.match(css,/body\.aksara-voice-3d-experiment dialog#voiceStyleDialog::backdrop/);
 assert.match(css,/body\.aksara-voice-3d-experiment #voiceStyleDialog button\.voice-style-option\.is-selected/);
 assert.match(css,/border-radius:29px!important/);
 assert.match(css,/backdrop-filter:blur\(27px\) saturate\(1\.18\)/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
});

test("call status never claims connection before setupComplete and clock resets with each session",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const browser=read("scripts/test-aksara-voice-v4-live-controls-browser.cjs");
 assert.match(js,/firstConnectedAt=0/);
 assert.match(js,/if\(connected&&!firstConnectedAt\)firstConnectedAt=Date\.now\(\)/);
 assert.match(js,/active&&firstConnectedAt\?/);
 assert.match(js,/!active\?"SEDIA"/);
 assert.match(js,/connected\?"LIVE"/);
 assert.match(js,/"SAMBUNG SEMULA"/);
 assert.match(browser,/actual media track wasn't muted/);
 assert.match(browser,/end button didn't stop microphone stream/);
 assert.match(browser,/timer started before handshake/);
 assert.match(browser,/timer didn't reset for second session/);
});


test("V4 keeps the original Voice error notice visible above the glass modal",()=>{
 const html=read("bilik-antara.html");
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(html,/id="voiceNotice"/);
 assert.match(js,/const nativeNotice=document\.getElementById\("voiceNotice"\)/);
 assert.match(js,/document\.body\.appendChild\(nativeNotice\)/);
 assert.match(css,/body\.aksara-voice-3d-experiment #voiceNotice\.voice-notice:not\(\[hidden\]\)/);
 assert.match(css,/z-index:2010!important/);
 assert.doesNotMatch(js,/new WebSocket|new AudioContext|\.getUserMedia\(|fetch\(/);
});


test("V4.5 uses translucent A/B/C glass tokens while keeping the native voice bridge untouched",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const html=read("bilik-antara.html");
 const js=read("bilik-antara-voice-experiment-v3.js");
 for(const token of ["--voice-v45-root","--voice-v45-secondary","--voice-v45-control","--voice-v45-rim","--voice-v45-gleam"]){
   assert.ok(css.includes(token),token+" missing");
 }
 assert.match(css,/AKSARA VOICE V4\.5/);
 assert.match(css,/#voiceMuteMic\[aria-pressed="false"\]/);
 assert.match(css,/#voiceMuteSpeaker\[aria-pressed="false"\]/);
 assert.match(css,/prefers-reduced-transparency:reduce/);
 assert.match(css,/max-width:760px\) and \(max-height:670px/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=15/);
 assert.doesNotMatch(js,/new WebSocket|new AudioContext|\.getUserMedia\(|fetch\(/);
});


test("glass preflight and Terminal picker are presentation-only",()=>{
 const ui=read("bilik-antara-ui-polish.js");
 const skin=read("bilik-antara-ui-polish.css");
 const html=read("bilik-antara.html");
 const live=read("bilik-antara-voice.js");
 assert.match(html,/bilik-antara-ui-polish\.js\?v=3/);
 assert.match(ui,/addEventListener\("click",event=>\{/);
 assert.match(ui,/event\.stopImmediatePropagation\(\)/);
 assert.match(ui,/navigator\.permissions\.query\(\{name:"microphone"\}\)/);
 assert.match(ui,/permission==="granted"/);
 assert.match(ui,/live\.click\(\)/);
 assert.match(ui,/if\(!native\|\|!native\.parentElement\)return/);
 assert.match(ui,/native\.dispatchEvent\(new Event\("change"/);
 assert.match(ui,/attach\("aitFile","aitFileGlass"/);
 assert.match(ui,/attach\("aitExampleSelect","aitExampleGlass"/);
 assert.doesNotMatch(ui,/getUserMedia\(|new WebSocket|new AudioContext|\/\.netlify\/functions/);
 assert.match(skin,/select\.ait-native-select\{display:none!important\}/);
 assert.match(skin,/background:linear-gradient/);
 assert.match(skin,/backdrop-filter:blur/);
 assert.match(ui,/<svg viewBox="0 0 24 24"/);
 assert.doesNotMatch(ui,/🎙/);
 assert.match(ui,/bilik-antara-ui-polish\.css\?v=3/);
 assert.match(skin,/rgba\(29,39,53,\.38\)/);
 assert.match(skin,/rgba\(10,17,30,\.30\)/);
 assert.match(skin,/background:rgba\(2,6,13,\.30\)/);
 assert.doesNotMatch(ui,/Brave/);
 assert.match(ui,/Pelayar mungkin meminta kebenaran mikrofon/);
 assert.match(skin,/blur\(27px\) saturate\(1\.18\)/);
 assert.match(skin,/\.aksara-glass-mic-icon svg/);
 assert.match(live,/LIVE_LOCKED_VOICE="Aoede"/);
});
