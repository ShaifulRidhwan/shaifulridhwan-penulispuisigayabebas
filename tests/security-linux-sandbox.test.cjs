"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "security-lab.html"), "utf8");
const js = fs.readFileSync(path.join(root, "linux-sandbox.js"), "utf8");
const css = fs.readFileSync(path.join(root, "linux-sandbox.css"), "utf8");

test("Linux tab uses standard Security Lab tab/panel wiring", () => {
  assert.match(html, /id="tab-linux"[^>]+role="tab"[^>]+data-tab="linux"/);
  assert.match(html, /id="panel-linux"[^>]+role="tabpanel"[^>]+data-panel="linux" hidden/);
  for (const id of ["linuxBoot", "linuxReset", "linuxPower", "linuxStatus", "linuxTerminal"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " control missing");
  }
  assert.match(html, /linux-sandbox\.js\?v=1/);
  assert.match(html, /linux-sandbox\.css\?v=1/);
});

test("VM boots actual Linux on demand without guest network relay", () => {
  assert.match(js, /new V86\(/);
  assert.match(js, /bzimage:/);
  assert.match(js, /serial_container: terminal/);
  assert.doesNotMatch(js, /network_relay_url\s*:/);
  assert.match(js, /bootButton\.addEventListener\("click", boot\)/);
  assert.match(js, /await oldVM\.destroy\(\)/);
});

test("glass layout and minimum mobile ergonomics are defined", () => {
  assert.match(css, /backdrop-filter:blur\(24px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /grid-template-columns:repeat\(5/);
});
