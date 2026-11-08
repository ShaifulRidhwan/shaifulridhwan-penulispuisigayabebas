# Bilik Antara mobile design specification

Audit date: 2026-11-08. Baseline source commit: `f482b8ed393fe0eb4277ae3eaf3938f1593489c4`.

Authoritative app deployment: https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.html. Netlify remains the canonical/home origin. Production HTML SHA-256 `96225165d62ac923fdc7ff8d42e55c27dea896b290f0b11a58182f359fe4b980` exactly matches `node cloudflare/build.mjs` at the baseline. This is content equivalence, not a claim that the server publishes a Git SHA.

Screenshots and computed styles: GitHub Actions run 42456898333, artifact 13607339160. All measurements are CSS pixels at DPR 1; equivalent Android screenshots must use the same content viewport in dp. System chrome is excluded. Inference/status responses in visual fixtures are explicitly intercepted; these images do not prove backend connectivity.

## Effective cascade

- https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&family=Space+Grotesk:wght@400;500;600;700&display=swap
- https://aksara-apps.mshaifulridhwan.workers.dev/aksara-glass-tokens.css?v=1
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.css?v=108
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-voice-v3.css?v=4
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-multi-ai-status.css?v=2
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-knowledge-hub.css?v=2
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-attachments.css?v=3
- inline
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-suite.css?v=9
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-code-execution.css?v=1
- inline
- inline
- inline
- inline
- inline
- inline
- inline
- inline
- inline
- inline
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-voice-experiment-v3.css?v=15
- https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-ui-polish.css?v=3

Dynamic style sheets and inline style elements were captured after page scripts and `document.fonts.ready`. The machine-readable JSON records every visible element, not only the selectors in this table.

## Measured initial screen at 390 × 844

| Component | x, y | width × height | Typography | Radius | Blur |
|---|---|---|---|---|---|
| topbar aksara-header | 0.00, 10.00 | 390.00 × 50.00 | 14px/22.4px, 400 | 17px | blur(12px) saturate(1.15) |
| conversation | 7.00, 69.28 | 376.00 × 767.72 | 14px/22.4px, 400 | 18px | blur(3px) saturate(1.06) |
| conversation-head | 8.00, 70.28 | 374.00 × 54.00 | 14px/22.4px, 400 | 0px | none |
| voiceLive | 13.00, 78.28 | 82.33 × 37.00 | 9px/12.6px, 500 | 999px | blur(2px) saturate(1.1) |
| codeEngineStatus | 98.33, 78.28 | 38.00 × 37.00 | 9px/12.6px, 500 | 999px | blur(8px) saturate(1.12) |
| codeAITerminalOpen | 139.33, 78.28 | 38.00 × 37.00 | 9px/12.6px, 500 | 999px | blur(8px) saturate(1.12) |
| connection | 180.33, 78.28 | 196.67 × 37.00 | 10px/14px, 500 | 999px | blur(9px) saturate(1.1) |
| chat | 8.00, 124.28 | 374.00 × 585.72 | 14px/22.4px, 400 | 0px | none |
| byline | 62.00, 138.28 | 85.78 × 16.19 | 12px/16.2px, 600 | 0px | none |
| bubble | 62.00, 160.47 | 303.00 × 95.53 | 15px/23.85px, 400 | 13px 13px 13px 4px | blur(2px) saturate(1.07) |
| starters | 8.00, 710.00 | 374.00 × 49.00 | 14px/22.4px, 400 | 0px | none |
| composer-area | 8.00, 759.00 | 374.00 × 77.00 | 14px/22.4px, 400 | 0px | none |
| composer | 17.00, 768.00 | 356.00 × 58.00 | 14px/22.4px, 400 | 16px | blur(2px) saturate(1.07) |
| input | 72.00, 775.00 | 201.00 × 44.00 | 16px/24px, 400 | 0px | none |
| thoughtMode | 278.00, 777.00 | 40.00 × 42.00 | 14px/22.4px, 400 | 13px | blur(2px) |
| sendBtn | 323.00, 777.00 | 42.00 × 42.00 | 14px/22.4px, 400 | 13px | blur(2px) |

## Detailed measured tokens

### topbar aksara-header

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "14px",
  "fontWeight": "400",
  "lineHeight": "22.4px",
  "padding": "0px 9px",
  "borderRadius": "17px",
  "border": "1px solid rgba(247, 226, 196, 0.25)",
  "backdropFilter": "blur(12px) saturate(1.15)",
  "backgroundImage": "linear-gradient(115deg, rgba(8, 14, 24, 0.4), rgba(17, 26, 40, 0.2))"
}
```

### conversation

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "14px",
  "fontWeight": "400",
  "lineHeight": "22.4px",
  "padding": "0px",
  "borderRadius": "18px",
  "border": "1px solid rgba(253, 214, 150, 0.57)",
  "backdropFilter": "blur(3px) saturate(1.06)",
  "backgroundImage": "linear-gradient(140deg, rgba(15, 17, 25, 0.2), rgba(10, 14, 25, 0.13) 48%, rgba(7, 10, 18, 0.22))"
}
```

### voiceLive

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "9px",
  "fontWeight": "500",
  "lineHeight": "12.6px",
  "padding": "7px 6px",
  "borderRadius": "999px",
  "border": "1px solid rgba(244, 225, 192, 0.31)",
  "backdropFilter": "blur(2px) saturate(1.1)",
  "backgroundImage": "linear-gradient(145deg, rgba(255, 247, 224, 0.035), rgba(125, 167, 205, 0.02))"
}
```

### connection

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "10px",
  "fontWeight": "500",
  "lineHeight": "14px",
  "padding": "0px 4px",
  "borderRadius": "999px",
  "border": "1px solid rgba(244, 225, 192, 0.31)",
  "backdropFilter": "blur(9px) saturate(1.1)",
  "backgroundImage": "linear-gradient(145deg, rgba(255, 247, 224, 0.035), rgba(125, 167, 205, 0.02))"
}
```

### bubble

```json
{
  "fontFamily": "\"DM Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif",
  "fontSize": "15px",
  "fontWeight": "400",
  "lineHeight": "23.85px",
  "padding": "11px 12px",
  "borderRadius": "13px 13px 13px 4px",
  "border": "1px solid rgba(240, 211, 164, 0.34)",
  "backdropFilter": "blur(2px) saturate(1.07)",
  "backgroundImage": "linear-gradient(145deg, rgba(243, 226, 198, 0.047), rgba(125, 165, 203, 0.024))"
}
```

### composer

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "14px",
  "fontWeight": "400",
  "lineHeight": "22.4px",
  "padding": "6px 7px",
  "borderRadius": "16px",
  "border": "1px solid rgba(245, 217, 176, 0.32)",
  "backdropFilter": "blur(2px) saturate(1.07)",
  "backgroundImage": "linear-gradient(135deg, rgba(25, 35, 49, 0.067), rgba(8, 15, 28, 0.043))"
}
```

### thoughtMode

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "14px",
  "fontWeight": "400",
  "lineHeight": "22.4px",
  "padding": "0px",
  "borderRadius": "13px",
  "border": "1px solid rgba(245, 208, 157, 0.43)",
  "backdropFilter": "blur(2px)",
  "backgroundImage": "linear-gradient(145deg, rgba(238, 201, 140, 0.086), rgba(19, 31, 49, 0.12))"
}
```

### sendBtn

```json
{
  "fontFamily": "\"DM Sans\", system-ui, sans-serif",
  "fontSize": "14px",
  "fontWeight": "400",
  "lineHeight": "22.4px",
  "padding": "0px",
  "borderRadius": "13px",
  "border": "1px solid rgba(244, 213, 166, 0.3)",
  "backdropFilter": "blur(2px)",
  "backgroundImage": "linear-gradient(145deg, rgba(244, 216, 171, 0.055), rgba(64, 87, 112, 0.035))"
}
```

## Responsive and overlays

The main mobile artwork changes at 760px. At <=400px the voice label uses 9px text, a tighter header gap and 5px horizontal padding; at 412px it uses the wider rule. Code/Terminal labels are hidden at all three measured phone widths. App top padding is `clamp(...)`/viewport dependent: 8.80px at 800px high, 9.28px at 844px, 10.06px at 915px. Main side/bottom margins are 7px. Composer font is 16px/24px; bubbles use 15px/23.85px and -0.12px tracking.

| Overlay at 390 × 844 | x, y | width × height | Padding | Radius | Blur |
|---|---|---|---|---|---|
| connection | 17.00, 209.11 | 356.00 × 425.77 | 15px | 19px | blur(4px) saturate(1.06) |
| code | 17.00, 52.00 | 356.00 × 740.00 | 15px | 19px | blur(4px) saturate(1.06) |
| terminal | 14.00, 97.00 | 362.00 × 650.00 | 14px | 19px | blur(4px) saturate(1.06) |
| portal | 14.00, 127.20 | 362.00 × 589.59 | 15px | 19px | blur(4px) saturate(1.06) |
| thinking | 17.00, 212.20 | 356.00 × 419.59 | 15px | 19px | blur(4px) saturate(1.06) |
| attachments | 17.00, 125.22 | 356.00 × 593.55 | 15px | 19px | blur(4px) saturate(1.06) |
| voice-permission | 15.00, 281.70 | 360.00 × 280.59 | 17px | 24px | blur(27px) saturate(1.18) |

## Assets and animation

Use the original `aksara-cinematic-mobile.webp`, desktop counterpart and `bilik-antara-chat-portrait.webp`; no regenerated artwork. CSS background is cover/center. The mobile full-screen overlay gradient has RGBA stops `(3,6,12,.13)` at 0%, `(4,7,13,.18)` at 30%, `(3,6,13,.32)` at 55%, `(3,5,10,.61)` at 100%. Full motion uses 19s/24s glow, 26s mist, 5.8s thinking, 1s mode fade. Reduced-motion disables these layers in deterministic tests.

Fonts are DM Sans variable (UI/body) and Space Grotesk (selected labels/headings); Source Serif 4/Fraunces are loaded but do not determine the phone brand child spans. Font files retain their OFL license. Android include-font-padding must be disabled.

## Audit boundaries

This first capture covers seven overlays and initial/chat/loading/focused composer at three sizes. The browser does not create a real Android IME; `composer-focused` is NOT evidence of keyboard parity. Voice permission preflight was captured without enabling a microphone. Active voice, nested preferences, Code Workspace, Evaluation Lab, sessions, knowledge, Studio, library, Security Lab and Linux/Game require additional audit before parity can be accepted. Those screens cannot be marked passed from this baseline. All comparison claims require native captures.


## Verified font instancing detail (recovery audit)

Google Fonts' Latin DM Sans v17 WOFF2 (`https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2`) is version4.004, matching the bundled original TTF. However the web file has only the wght variable axis: opsz is already instantiated at14. The bundled full TTF defaults to opsz9. FontTools instancing at14 reproduces the web hmtx advances (A664, a544, S580, d627, space266, i240, s502 units at wght400); the TTF default has a551, S586, d621, space269. HarfBuzz shaping of the Thinking Mode subtitle at12px is237.432px for both the web font and native opsz14, versus239.928px at native opsz9. This is an asset-metric finding, not a screenshot similarity score.

Use explicit supported axes wght + opsz14 for DM Sans and only wght for Space Grotesk. Native linear/subpixel text placement is being checked against the browser rather than relying on static integer glyph hinting. Measured dialog title tracking is0.4px. The54px status row already includes its bottom border; a second external1px separator shifts all messages down incorrectly.
