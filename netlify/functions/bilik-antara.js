/**
 * netlify/functions/bilik-antara.js
 * ------------------------------------------------------------------
 * Backend serverless Netlify untuk Bilik Antara — GEMINI API sahaja.
 * Endpoint: /.netlify/functions/bilik-antara
 * LETAK FAIL INI BERSAMA novel-kb.json di dalam: netlify/functions/
 *
 * ENV (Netlify dashboard): GEMINI_API_KEY (wajib), GEMINI_MODEL (pilihan),
 * ALLOWED_ORIGIN (pilihan).
 *
 * PENTING — HAD MASA (tiga jenis, jangan dikelirukan):
 *   A. Timeout PELAYAR (bilik-antara.html): 20s — probe/soalan diberhentikan
 *      di sisi pelayar jika tiada respons.
 *   B. Had masa FUNGSI Netlify: lalai pelan (Free ~10s, Pro 26–60s). Jika
 *      fungsi dibunuh di sini, pelayar terima sambungan terputus (tiada JSON).
 *   C. Timeout panggilan GEMINI (dalam fail ini): maksimum 7s untuk satu
 *      panggilan terus. Tiada fallback model supaya fungsi sempat memulangkan
 *      respons terkawal dalam had masa platform.
 *
 * LOG DIAGNOSTIK (selamat): console.log hanya medan tidak sensitif — fasa,
 * model, status HTTP, tempoh ms, panjang soalan, bilangan petikan.
 * API key, teks soalan penuh, dan petikan TIDAK pernah dilog.
 * ------------------------------------------------------------------
 */

const KB = require("./novel-kb.json");

const PER_CALL_MS = 20000; // had masa panggilan Gemini, lebih pendek daripada had fungsi biasa

const STOPWORDS = new Set(
  ("yang di dan ke dari kepada dengan untuk adalah ini itu akan telah sudah bagi juga atau tetapi maka kerana sehingga ketika apabila apa bagaimana mengapa boleh bolehkah saya aku kau kamu kita mereka ia dia nya lah pun lah lagi sangat terlalu hanya sudah belum pernah akan mahu hendak dapat kepada dalam pada atas bawah antara melalui selepas sebelum ketika serta serta dan atau tidak ya bukan apakah bagaimana mengapa siapa mana berapa the a an of to in on at for and or is are was were be been it this that with by from as not we you they he she i my your their his her its what which who how why when where can could would should do does did have has had but if so such no yes akan patut harus perlu mungkin jangan boleh ada lagi macam cara sangat terlalu sekali").split(/\s+/)
);

const NOVEL_KEYWORDS = [
  "antara","cahaya","gelap","novel","buku","petikan","shaiful","ridhwan","gaya bebas","penulis",
  "akal","ilmu","kebenaran","bohong","pembohongan","reputasi","cerita","bijak","tahu","tahukah",
  "iman","percaya","ragu","pasti","kepercayaan","amanah","agama","tuhan","jodoh","syariat",
  "cinta","kasih","sayang","punya","pinjam","topeng","kenali","pasangan","hubungan","mask",
  "bebas","kebebasan","pintu","pagar","kuasa","pilihan","pilih","takut","hormat","tunduk","politik","pemimpin","diktator",
  "masa","waktu","hari ini","esok","lalu","sudah","belum","menunggu","destinasi","tunggangan","time",
  "hidup","rumah","tinggal","tempat","akhir","penutup","kesimpulan","jawapan","maksud","tema","tafsir","mesej","hidup di antara"
];

const SYS_NOVEL = `Anda adalah Pemandu Bilik Antara — pembimbing perbualan untuk novel falsafah "Antara Cahaya dan Gelap" oleh Shaiful Ridhwan. Anda BERBAHASA MELAYU.
PERATURAN WAJIB:
1. PETIKAN BENAR SAHAJA — hanya kutip teks dari EXCERPTS yang dibekalkan. JANGAN mereka petikan. Jika tiada petikan berkaitan, nyatakan: "Novel tidak menyatakan perkara ini secara eksplisit dalam petikan yang saya akses."
2. TIGA LAPISAN BERLABEL dalam medan "reply": PETIKAN SEBENAR (verbatim + nama bahagian), TAFSIRAN MUNASABAH (satu pembacaan, berhedged), CATATAN HAD (apa yang novel tidak katakan; jangan dakwa niat penulis tanpa bukti).
3. Jika soalan di luar skop novel, set "mode":"general" dan jawab secara umum sahaja.
4. Output JSON sah: { "mode":"novel", "reply":"...", "quotes":[{"text":"...","section":"..."}], "disclaimer":"..." }.`;

const SYS_GENERAL = `Anda pembantu yang membantu, menjawab dalam Bahasa Melayu (atau bahasa soalan). Jawab dengan ringkas dan jelas. Ini adalah Mod Umum — soalan di luar novel "Antara Cahaya dan Gelap". Jangan mengarang petikan novel. Akhiri dengan satu ayat penafian ringkas bahawa ini jawapan umum, bukan tafsiran novel. Output JSON sah: { "mode":"general", "reply":"...", "quotes":[], "disclaimer":"..." }.`;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}
function log(msg, extra) { console.log("[bilik-antara] " + msg + (extra ? " " + JSON.stringify(extra) : "")); }

function termsOf(text) {
  return text.toLowerCase().replace(/[^a-zà-ÿ\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}
function classifyMode(question, history) {
  const q = question.toLowerCase();
  for (const kw of NOVEL_KEYWORDS) if (q.indexOf(kw) !== -1) return "novel";
  const last = history && history[history.length - 1];
  if (last && last.role === "assistant" && question.length < 60) return "novel";
  return "general";
}
function selectExcerpts(question, maxChars = 3500, maxCount = 7) {
  const qterms = termsOf(question);
  if (!qterms.length) return KB.excerpts.filter(e => e.type === "quote").slice(0, maxCount);
  const scored = KB.excerpts.map(ex => {
    const t = (ex.section + " " + ex.text).toLowerCase();
    let s = 0;
    for (const w of qterms) if (t.indexOf(w) !== -1) s++;
    if (s > 0 && ex.type === "quote") s += 0.5;
    return { ex, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  const picked = []; const perSec = {}; let chars = 0;
  for (const { ex } of scored) {
    if (picked.length >= maxCount) break;
    if (chars + ex.text.length > maxChars) continue;
    perSec[ex.section_id] = (perSec[ex.section_id] || 0) + 1;
    if (perSec[ex.section_id] > 3) continue;
    picked.push(ex); chars += ex.text.length;
  }
  if (picked.length < 3) {
    for (const ex of KB.excerpts) {
      if (picked.length >= 3) break;
      if (ex.type === "quote" && !picked.includes(ex)) picked.push(ex);
    }
  }
  return picked;
}
function norm(s) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[“”"']/g, ""); }
function validateQuote(text) {
  if (!text || text.length < 15) return null;
  const n = norm(text);
  for (const ex of KB.excerpts) {
    const ne = norm(ex.text);
    if (ne.indexOf(n) !== -1 || n.indexOf(ne) !== -1) return { text: ex.text, section: ex.section };
  }
  return null;
}
const rl = new Map();
function rateLimited(ip) {
  const now = Date.now(), WIN = 60000, MAX = 12;
  const e = rl.get(ip);
  if (!e || now - e.start > WIN) { rl.set(ip, { count: 1, start: now }); return false; }
  e.count++;
  return e.count > MAX;
}

/* Panggilan Gemini dengan had masa per-cubaan (tidak pernah melebihi baki deadline global) */
async function callGemini({ apiKey, model, system, contents, maxTokens, timeoutMs, remainingMs }) {
  const budget = Math.min(timeoutMs || PER_CALL_MS, Math.max(500, (remainingMs || PER_CALL_MS) - 800));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), budget);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: contents,
        generationConfig: {
  maxOutputTokens: Math.max(maxTokens, 64),
  responseMimeType: "application/json",
  thinkingConfig: {
    thinkingLevel: "low"
  }
}
      signal: ctrl.signal
    });
    const dur = Date.now() - t0;
    if (!res.ok) {
      log("gemini-result", { model, status: res.status, durMs: dur });
      const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err;
    }
    const data = await res.json();
    log("gemini-result", { model, status: 200, durMs: dur, finishReason: data && data.candidates && data.candidates[0] && data.candidates[0].finishReason });
    return data;
  } finally { clearTimeout(to); }
}

function geminiErrorMsg(code) {
  if (code === 401) return "Kekunci API ditolak (401). Semak nilai GEMINI_API_KEY (tiada ruah/quote), status kekunci di AI Studio, dan pastikan Generative Language API diaktifkan.";
  if (code === 403) return "Akses ditolak (403). Kekunci mungkin mempunyai sekatan API, billing belum diaktifkan, atau wilayah tidak disokong.";
  if (code === 429) return "Kuota Gemini API dicapai (429). Had percuma harian mungkin habis (reset tengah malam Waktu Pasifik). Cuba lagi nanti atau tukar GEMINI_MODEL.";
  if (code === 404) return "Model atau endpoint Gemini tidak ditemui (404). Semak nama model yang tersenarai dalam models.list dan endpoint API.";
  if (code === 400) return "Permintaan salah format (400).";
  return "Tidak dapat menghubungi Gemini API (status " + code + ").";
}

exports.handler = async (event) => {
  const started = Date.now();
  const H = corsHeaders();
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Method not allowed" }) };

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: H, body: JSON.stringify({ error: "Bad JSON" }) }; }

  const apiKey = process.env.GEMINI_API_KEY;
  const preferredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const question = String(payload.question || "").trim().slice(0, 1000);
  log("start", { probe: !!payload.probe, qlen: question.length, hasKey: !!apiKey });

  if (!payload.probe && !question) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "Soalan kosong" }) };

  // PROBE — panggilan Gemini MINI sebenar (bukan semak key sahaja)
  if (payload.probe) {
    if (!apiKey) { log("probe-no-key"); return { statusCode: 503, headers: H, body: JSON.stringify({ ok: false, error: "GEMINI_API_KEY belum ditetapkan di Netlify environment variables." }) }; }
    try {
      await callGemini({ apiKey, model: preferredModel, system: "Balas dengan perkataan OK sahaja.", contents: [{ role: "user", parts: [{ text: "ok" }] }], maxTokens: 8, timeoutMs: PER_CALL_MS, remainingMs: PER_CALL_MS + 800 });
      log("probe-ok", { modelUsed: preferredModel, totalMs: Date.now() - started });
      return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, mode: "live", model: preferredModel, probeMs: Date.now() - started }) };
    } catch (e) {
      const code = e && e.status;
      const msg = (e && (e.name === "AbortError" || e.deadline))
        ? "Probe tamat masa — Gemini tidak membalas dalam had panggilan 7 saat. Semak log dan konfigurasi sambungan."
        : geminiErrorMsg(code);
      log("probe-fail", { status: code || (e && e.name) || "err", totalMs: Date.now() - started });
      return { statusCode: 502, headers: H, body: JSON.stringify({ ok: false, error: msg, status: code || null }) };
    }
  }

  if (!apiKey) return { statusCode: 503, headers: H, body: JSON.stringify({ error: "Backend belum dikonfigurasi: GEMINI_API_KEY tiada." }) };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "").split(",")[0].trim()) || "unknown";
  if (rateLimited(ip)) return { statusCode: 429, headers: H, body: JSON.stringify({ error: "Had penggunaan sementara dicapai (cuba lagi dalam seminit)." }) };

  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const mode = classifyMode(question, history);
  const geminiContents = history
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, 1000) }] }))
    .concat([{ role: "user", parts: [{ text: question }] }]);

  log("ask-start", { mode, qlen: question.length, historyLen: geminiContents.length });

  try {
    let picked = [], excerptCount = 0, modelUsed = preferredModel, data;
    if (mode === "novel") {
      picked = selectExcerpts(question);
      excerptCount = picked.length;
      const excerptBlock = picked.map((e, i) => `[${i + 1}] (${e.section}) ${e.text}`).join("\n");
      log("ask-excerpts", { excerptCount, chars: excerptBlock.length });
      data = await callGemini({ apiKey, model: preferredModel, system: SYS_NOVEL + "\n\nEXCERPTS (satu-satunya petikan yang boleh anda kutip):\n" + excerptBlock, contents: geminiContents, maxTokens: 900, timeoutMs: PER_CALL_MS, remainingMs: PER_CALL_MS + 800 });
      modelUsed = preferredModel;
      log("gemini-success", { modelUsed, totalMs: Date.now() - started });
    } else {
      data = await callGemini({ apiKey, model: preferredModel, system: SYS_GENERAL, contents: geminiContents, maxTokens: 600, timeoutMs: PER_CALL_MS, remainingMs: PER_CALL_MS + 800 });
      modelUsed = preferredModel;
      log("gemini-success", { modelUsed, totalMs: Date.now() - started });
    }

    const cand = data && data.candidates && data.candidates[0];
    const finishReason = cand && cand.finishReason;
    const rawText = cand && cand.content && cand.content.parts && cand.content.parts.map(p => p.text || "").join("");
    let parsed = {};
    try { parsed = JSON.parse(rawText); } catch { parsed = { reply: String(rawText || ""), quotes: [], mode }; }
    const replyMode = parsed.mode === "general" ? "general" : mode;

    let safeQuotes = []; let dropped = 0;
    if (replyMode === "novel") {
      for (const q of (parsed.quotes || [])) {
        const v = validateQuote(q && q.text);
        if (v) safeQuotes.push(v); else dropped++;
      }
    }
    const privacy = replyMode === "novel"
      ? `Hanya ${excerptCount} petikan/perenggan berkaitan dihantar ke Gemini. Pada tier percuma, data mungkin digunakan Google untuk memperbaiki produk.`
      : "Mod Umum — tiada petikan novel dihantar. Pada tier percuma Gemini, soalan mungkin digunakan Google untuk memperbaiki produk.";
    log("ask-ok", { aiMode: replyMode, modelUsed, quotes: safeQuotes.length, dropped, totalMs: Date.now() - started });
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        mode: "live", aiMode: replyMode, model: modelUsed,
        reply: parsed.reply || "",
        quotes: safeQuotes,
        disclaimer: (parsed.disclaimer ? parsed.disclaimer + " " : "") + privacy +
          (finishReason && finishReason !== "STOP" ? ` [Catatan: Gemini tamat dengan status ${finishReason}.]` : "") +
          (dropped ? ` [${dropped} petikan tidak disahkan terhadap sumber dan tidak dipaparkan.]` : ""),
        usage: data.usageMetadata || null,
        durMs: Date.now() - started
      })
    };
  } catch (err) {
    const totalMs = Date.now() - started;
    if (err && (err.name === "AbortError" || err.deadline)) {
      log("ask-timeout", { totalMs });
      return { statusCode: 504, headers: H,
        body: JSON.stringify({ error: `Gemini tidak membalas dalam had panggilan (${totalMs}ms). Ini ialah timeout panggilan Gemini, bukan bukti bahawa API key atau model tidak sah.` }) };
    }
    if (err && err.status === 429) { log("ask-429", { totalMs }); return { statusCode: 429, headers: H, body: JSON.stringify({ error: geminiErrorMsg(429) }) }; }
    if (err && err.status === 401 || err && err.status === 403 || err && err.status === 404) {
      log("ask-http-error", { status: err.status, totalMs });
      return { statusCode: 502, headers: H, body: JSON.stringify({ error: geminiErrorMsg(err.status) }) };
    }
    log("ask-error", { err: String(err && err.message || err).slice(0, 80), totalMs });
    return { statusCode: 502, headers: H, body: JSON.stringify({ error: `Gagal menghubungi Gemini API (status ${err && err.status || "sambungan"}).` }) };
  }
};
