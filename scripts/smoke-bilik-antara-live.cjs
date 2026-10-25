"use strict";
/*
 * One-time real-service smoke test. Runs in GitHub Actions with no secrets:
 * the normal API key remains server-side in Netlify; the Live token expires.
 * Do not log API responses, token values, or user conversations.
 */
const assert = require("node:assert/strict");
const ORIGIN = "https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const BASE = process.env.BILIK_ANTARA_ORIGIN || ORIGIN;
function log(message) { process.stdout.write("[Bilik Antara] " + message + "\n"); }

async function post(path, data, ms) {
  const response = await fetch(new URL(path, BASE), {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
    signal: AbortSignal.timeout(ms || 45000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Error(path + " returned HTTP " + response.status + "; reason: " +
      String(body.reason || body.error || "unknown").slice(0, 150));
  }
  return body;
}

async function checkLiveAudio(token, model) {
  assert.equal(typeof WebSocket, "function", "Node.js 22 global WebSocket required");
  const url = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" +
    encodeURIComponent(token);
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let configured = false, hasAudio = false, settled = false, opened = false, seen = 0;
    const timer = setTimeout(() => finish(Error("Gemini Live timed out (socket-open=" + opened + ", setup-complete=" + configured + ", messages=" + seen + ", audio=" + hasAudio + ")")), 45000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      if (error) reject(error);
      else resolve();
    }
    ws.addEventListener("open", () => {
      opened = true;
      log("Gemini Live WebSocket open event");
      ws.send(JSON.stringify({
        setup: {
          model: "models/" + model,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {voiceConfig:{prebuiltVoiceConfig:{voiceName:"Charon"}}}
          },
          outputAudioTranscription: {},
          systemInstruction: {parts:[{text:"Balas dalam Bahasa Melayu Malaysia dengan satu ayat sahaja."}]}
        }
      }));
    });
    ws.addEventListener("message", event => {
      seen++;
      if (seen <= 2) log("Gemini Live message received: data-type=" + typeof event.data);
      let packet;
      try { packet = JSON.parse(String(event.data)); } catch (_) { if (seen <= 2) log("Gemini Live message was not JSON text"); return; }
      if (seen <= 2) log("Gemini Live packet fields=" + Object.keys(packet).join(","));
      if (packet.setupComplete && !configured) {
        configured = true;
        log("Gemini Live WebSocket setupComplete diterima");
        ws.send(JSON.stringify({
          clientContent: {turns:[{role:"user",parts:[{text:"Ucap selamat datang secara ringkas."}]}],turnComplete:true}
        }));
      }
      const content = packet.serverContent || {};
      for (const part of (content.modelTurn && content.modelTurn.parts) || []) {
        if (part.inlineData && part.inlineData.data &&
            String(part.inlineData.mimeType || "").startsWith("audio/")) hasAudio = true;
      }
      if (content.turnComplete && hasAudio) finish();
      if (packet.goAway && !hasAudio) finish(Error("Gemini Live ended before any audio"));
    });
    ws.addEventListener("close", event => {
      if (!settled) finish(Error("Gemini Live WebSocket closed before audio; code " + event.code));
    });
    ws.addEventListener("error", () => {
      if (!settled) finish(Error("Gemini Live WebSocket network error"));
    });
  });
}

async function main() {
  log("Ujian production bermula; tiada kunci API disimpan dalam GitHub");
  const probe = await post("/.netlify/functions/bilik-antara", {probe:true}, 25000);
  assert.equal(probe.ok, true);
  log("Probe Netlify: backend tersedia (ini belum mengesahkan Gemini)");
  const failures = [];
  if (process.env.SKIP_GEMINI_TEXT !== "1") try {
    const answer = await post("/.netlify/functions/bilik-antara", {
      question:"Berikan satu ayat ringkas tentang hubungan antara akal dan bukti."
    }, 50000);
    assert.equal(answer.mode, "live");
    assert.ok(typeof answer.reply === "string" && answer.reply.trim().length > 2);
    log("Gemini generateContent: jawapan sebenar diterima; " + answer.reply.trim().length + " aksara");
  } catch (error) {
    log("Gemini generateContent belum lulus: " + String(error.message || error).slice(0, 180));
    failures.push("Gemini text");
  }
  try {
    const ticket = await post("/.netlify/functions/bilik-antara-live-token", {}, 30000);
    assert.ok(typeof ticket.token === "string" && ticket.token.length > 10);
    assert.match(ticket.model, /^gemini-3\.8-live/);
    log("Token sementara Gemini Live dikeluarkan tanpa mendedahkan token");
    await checkLiveAudio(ticket.token, ticket.model);
    log("Gemini Live: sambungan, setup, dan balasan audio sebenar berjaya");
  } catch (error) {
    log("Gemini Live belum lulus: " + String(error.message || error).slice(0, 180));
    failures.push("Gemini Live");
  }
  if (failures.length) throw Error("Semakan belum lulus: " + failures.join(", "));

}
main().catch(error => {
  console.error("[Bilik Antara] Ujian gagal: " + String(error && error.message || error).slice(0, 260));
  process.exitCode = 1;
});