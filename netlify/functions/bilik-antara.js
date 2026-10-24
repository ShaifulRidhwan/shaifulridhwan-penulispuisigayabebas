/**
 * netlify/functions/bilik-antara.js
 * ------------------------------------------------------------------
 * Backend serverless Netlify untuk Bilik Antara — SEMBANG BEBAS AI.
 * Endpoint: /.netlify/functions/bilik-antara (NAMA & ENDPOINT TIDAK DIUBAH).
 *
 * Perubahan berbanding versi novel:
 *   - Mod sembang bebas adalah SATU-SATUNYA mod. Tiada lagi mod novel,
 *     tiada lagi require novel-kb.json, tiada pemilihan petikan/RAG,
 *     tiada pengesahan petikan. novel-kb.json TIDAK lagi diperlukan
 *     untuk deploy fungsi ini (fail itu boleh dibiarkan dalam repo
 *     jika masih diperlukan oleh halaman lain, tetapi tidak dipanggil).
 *   - Soalan tentang identiti Shaiful Ridhwan dijawab secara
 *     deterministik dari fakta awam yang disahkan — TIADA panggilan
 *     Gemini, TIADA rekaan biodata peribadi.
 *   - Model lalai dinaik taraf kepada gemini-3.8-flash (Flash paling pintar,
 *     stabil, pengganti rasmi 3.6/3.7 — bentuk API sama). GEMINI_MODEL (env)
 *     masih boleh mengatasi (cth: gemini-4-argon untuk penaakulan tertinggi).
 *
 * ENV (Netlify dashboard): GEMINI_API_KEY (wajib), GEMINI_MODEL (pilihan),
 * ALLOWED_ORIGIN (pilihan).
 *
 * HAD MASA:
 *   A. Timeout PELAYAR (bilik-antara.html): 30s.
 *   B. Had masa FUNGSI Netlify: lalai pelan (Free ~10s, Pro 26–60s).
 *   C. Timeout panggilan GEMINI (dalam fail ini): maksimum 20s untuk
 *      satu panggilan terus. Tiada fallback model supaya fungsi sempat
 *      memulangkan respons terkawal dalam had masa platform.
 *
 * LOG DIAGNOSTIK (selamat): console.log hanya medan tidak sensitif — fasa,
 * model, status HTTP, tempoh ms, panjang soalan. API key dan teks soalan
 * penuh TIDAK pernah dilog.
 * ------------------------------------------------------------------
 */
const PER_CALL_MS = 20000; // had masa panggilan Gemini, lebih pendek daripada had fungsi biasa

/* Fakta awam yang DISAHKAN tentang Shaiful Ridhwan — SATU-SATUNYA maklumat
   yang boleh dipaparkan. Jangan tambah butiran peribadi (umur, asal, dll.)
   tanpa pengesahan. */
const SHAIFUL_FACTS = {
  reply: `Shaiful Ridhwan ialah penulis puisi gaya bebas di sebalik jenama puisigayabebas, yang meneroka sastera moden, cinta dan falsafah. Beliau juga penulis prosa falsafah Antara Cahaya dan Gelap.\n\nMaklumat ini berdasarkan butiran awam yang disahkan sahaja. Saya tidak menyimpan atau mencipta butiran peribadi lain (seperti biodata lengkap, umur, latar belakang atau butiran hubungan). Untuk sebarang maklumat lanjut, sila rujuk sumber rasmi beliau.`,
  disclaimer: "Jawapan ini dijana secara tempatan dari fakta awam yang disahkan — bukan oleh model AI, bagi mengelakkan sebarang rekaan biodata peribadi. Pada tier percuma Gemini, soalan lain mungkin digunakan Google untuk memperbaiki produk."
};

function isShaifulQuestion(question) {
  const q = question.toLowerCase();
  return q.indexOf("shaiful") !== -1 || q.indexOf("ridhwan") !== -1;
}

const SYS_FREE = `Anda ialah Bilik Antara — sebuah ruang kecerdasan buatan untuk berbual, berfikir dan mempersoalkan idea tentang falsafah, sastera, teknologi, manusia dan kehidupan. Anda BERBAHASA MELAYU moden secara lalai (tukar bahasa jika pengguna menulis dalam bahasa lain).

PERSONALITI & GAYA BAHASA (wajib):
1. Melayu moden yang semula jadi, santai, seperti berbual dengan teman diskusi — BUKAN pegawai membaca dokumen rasmi, bukan pensyarah berkuliah. Elak bahasa baku/rasmi berbunga-bunga tanpa keperluan.
2. Jawab TERUS kepada inti soalan dahulu, baru huraian tambahan. Elak mukadimah panjang dan frasa pembukaan berulang.
3. Panjang jawapan menyesuaikan soalan: soalan ringkas → jawapan ringkas. Jika pengguna minta analisis mendalam → huraian terperinci dan tersusun. Jangan buat setiap jawapan jadi esei.
4. Boleh gunakan analogi dan contoh dekat dengan kehidupan jika ia membantu pemahaman.
5. Ada humor, ironi dan sindiran HALUS mengikut konteks sahaja — TIDAK wajib dalam setiap jawapan. Jangan guraukan perkara serius/sensitif, dan jangan sampai sindiran terasa menghina.
6. Bijak tetapi tidak menunjuk-nunjuk. BOLEH membantah pendapat pengguna dengan alasan munasabah. Jangan mengiyakan semua perkara semata-mata untuk menyenangkan. Berani mempersoalkan andaian dan menunjukkan percanggahan hujah — tetapi dengan hormat.
7. Jika tidak tahu atau tidak pasti, akui dengan jujur. Jangan reka fakta. Mengakui kesilapan adalah perkara biasa.
8. Untuk perkara sensitif (kesedihan, krisis, hubungan), utamakan empati dan rasa hormat.
9. Jangan akhiri setiap jawapan dengan soalan susulan yang dipaksa. Hanya tanya jika ia benar-benar meneruskan perbualan.

KEPASTIAN & BATAS:
10. Ini sembang bebas — tiada skop novel. Jangan mengarang petikan atau karya sastera; jika mengutip, nyatakan ia parafrasa/ingatan, bukan petikan verbatim yang disahkan.
11. Khusus tentang Shaiful Ridhwan: hanya nyatakan yang berikut — dia penulis puisi gaya bebas di sebalik jenama puisigayabebas, meneroka sastera moden, cinta dan falsafah, dan penulis prosa falsafah Antara Cahaya dan Gelap. Jangan tambah butiran peribadi atau biodata tidak disahkan. (Biasanya soalan tentang beliau dijawab sebelum sampai kepada anda.)

Output JSON sah sahaja: { "mode":"general", "reply":"...", "quotes":[], "disclaimer":"" }.`;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}
function log(msg, extra) { console.log("[bilik-antara] " + msg + (extra ? " " + JSON.stringify(extra) : "")); }

const rl = new Map();
function rateLimited(ip) {
  const now = Date.now(), WIN = 60000, MAX = 12;
  const e = rl.get(ip);
  if (!e || now - e.start > WIN) { rl.set(ip, { count: 1, start: now }); return false; }
  e.count++;
  return e.count > MAX;
}

/* Panggilan Gemini dengan had masa per-cubaan (tidak pernah melebihi baki deadline global).
   Fungsi ini TIDAK diubah — ia adalah laluan yang telah berjaya diuji. */
async function callGemini({ apiKey, model, system, contents, maxTokens, timeoutMs, remainingMs }) {
  const budget = Math.min(timeoutMs || PER_CALL_MS, Math.max(500, (remainingMs || PER_CALL_MS) - 800));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), budget);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }]
        },
        contents: contents,
        generationConfig: {
          maxOutputTokens: Math.max(maxTokens, 64),
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "low"
          }
        }
      }),
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
  if (code === 404) return "Model atau endpoint Gemini tidak ditemui (404). Semak nama model yang tersenarai dalam models.list dan endpoint API. Model lalai sekarang: gemini-3.8-flash (boleh diatasi GEMINI_MODEL).";
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

  /* ---------- PROBE (tidak diubah) ---------- */
  if (payload.probe) {
    if (!apiKey) {
      return {
        statusCode: 503,
        headers: H,
        body: JSON.stringify({ ok: false, error: "GEMINI_API_KEY tiada" })
      };
    }
    const probeStarted = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(preferredModel)}:generateContent`;
      log("generation-probe-start", { model: preferredModel });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
          generationConfig: {
            maxOutputTokens: 64,
            responseMimeType: "text/plain",
            thinkingConfig: { thinkingLevel: "low" }
          }
        }),
        signal: ctrl.signal
      });
      const body = await res.text();
      log("generation-probe-result", { status: res.status, durMs: Date.now() - probeStarted, body: body.slice(0, 700) });
      return {
        statusCode: 200,
        headers: H,
        body: JSON.stringify({ ok: res.ok, httpStatus: res.status, durMs: Date.now() - probeStarted, result: body.slice(0, 700) })
      };
    } catch (err) {
      log("generation-probe-fail", { error: err.name, message: String(err.message || err).slice(0, 150), durMs: Date.now() - probeStarted });
      return {
        statusCode: 200,
        headers: H,
        body: JSON.stringify({
          ok: false,
          error: err.name === "AbortError"
            ? "Penjanaan teks tamat masa selepas 15 saat."
            : String(err.message || err)
        })
      };
    } finally {
      clearTimeout(timer);
    }
  }

  if (!apiKey) return { statusCode: 503, headers: H, body: JSON.stringify({ error: "Backend belum dikonfigurasi: GEMINI_API_KEY tiada." }) };
  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "").split(",")[0].trim()) || "unknown";
  if (rateLimited(ip)) return { statusCode: 429, headers: H, body: JSON.stringify({ error: "Had penggunaan sementara dicapai (cuba lagi dalam seminit)." }) };

  /* ---------- PENGENDALIAN DETERMINISTIK: Shaiful Ridhwan ----------
     Sebarang soalan yang menyebut nama beliau dijawab dari fakta awam
     yang disahkan sahaja. Tiada panggilan Gemini, tiada rekaan biodata. */
  if (isShaifulQuestion(question)) {
    log("ask-shaiful-grounded", { qlen: question.length, totalMs: Date.now() - started });
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        mode: "live",
        aiMode: "general",
        model: "grounded-facts",
        reply: SHAIFUL_FACTS.reply,
        quotes: [],
        disclaimer: SHAIFUL_FACTS.disclaimer,
        usage: null,
        durMs: Date.now() - started
      })
    };
  }

  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const geminiContents = history
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, 1000) }] }))
    .concat([{ role: "user", parts: [{ text: question }] }]);
  log("ask-start", { mode: "free", qlen: question.length, historyLen: geminiContents.length });

  try {
    const data = await callGemini({
      apiKey, model: preferredModel, system: SYS_FREE,
      contents: geminiContents, maxTokens: 800,
      timeoutMs: PER_CALL_MS, remainingMs: PER_CALL_MS + 800
    });
    const modelUsed = preferredModel;
    log("gemini-success", { modelUsed, totalMs: Date.now() - started });

    const cand = data && data.candidates && data.candidates[0];
    const finishReason = cand && cand.finishReason;
    const rawText = cand && cand.content && cand.content.parts && cand.content.parts.map(p => p.text || "").join("");
    let parsed = {};
    try { parsed = JSON.parse(rawText); } catch { parsed = { reply: String(rawText || ""), quotes: [], mode: "general" }; }

    const privacy = "Sembang bebas — tiada petikan novel dihantar. Pada tier percuma Gemini, soalan mungkin digunakan Google untuk memperbaiki produk.";
    log("ask-ok", { aiMode: "general", modelUsed, totalMs: Date.now() - started });
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        mode: "live", aiMode: "general", model: modelUsed,
        reply: parsed.reply || "",
        quotes: [],
        disclaimer: (parsed.disclaimer ? parsed.disclaimer + " " : "") + privacy +
          (finishReason && finishReason !== "STOP" ? ` [Catatan: Gemini tamat dengan status ${finishReason}.]` : ""),
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
    if (err && (err.status === 401 || err.status === 403 || err.status === 404)) {
      log("ask-http-error", { status: err.status, totalMs });
      return { statusCode: 502, headers: H, body: JSON.stringify({ error: geminiErrorMsg(err.status) }) };
    }
    log("ask-error", { err: String(err && err.message || err).slice(0, 80), totalMs });
    return { statusCode: 502, headers: H, body: JSON.stringify({ error: `Gagal menghubungi Gemini API (status ${err && err.status || "sambungan"}).` }) };
  }
};
