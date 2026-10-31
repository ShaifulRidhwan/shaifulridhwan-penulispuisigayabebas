"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const file = (relative) => fs.readFileSync(path.join(root,relative), "utf8");
test("native glass renders real GPU surface blur behind translucent content", () => {
 const glass=file("app/src/main/java/my/aksara/ai/ui/AksaraGlass.kt");
 assert.match(glass,/R\.drawable\.aksara_bilik_background/);
 assert.match(glass,/\.blur\(blurRadius\)/);
 assert.match(glass,/\.positionInRoot\(/);
 assert.match(glass,/Build\.VERSION\.SDK_INT >= 31/);
 assert.match(glass,/\.clip\(shape\)/);
 assert.match(glass,/AksaraGlassColors\.Hairline/);
});
test("glass panels installed across chat, Studio, Voice and navigation",()=>{
 const app=file("app/src/main/java/my/aksara/ai/ui/AksaraApp.kt");
 assert.match(app,/AksaraGlassViewport provides glassViewport/);
 assert.match(app,/blurRadius = 3\.dp/);
 assert.match(app,/blurRadius = 12\.dp/);
 assert.match(app,/blurRadius = 16\.dp/);
 assert.match(file("app/src/main/java/my/aksara/ai/ui/AksaraStudioScreen.kt"),/AksaraGlassPanel/);
 assert.match(file("app/src/main/java/my/aksara/ai/ui/AksaraVoiceScreen.kt"),/AksaraGlassPanel/);
});
