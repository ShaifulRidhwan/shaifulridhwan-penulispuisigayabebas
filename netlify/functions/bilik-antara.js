/**
 * netlify/functions/bilik-antara.js
 * ------------------------------------------------------------------
 * Backend serverless Netlify untuk Bilik Antara — GEMINI API sahaja.
 * Nama fail inilah yang menentukan endpoint: /.netlify/functions/bilik-antara
 * (sepadu dengan panggilan dalam bilik-antara.html).
 *
 * LETAK FAIL INI BERSAMA novel-kb.json di dalam folder: netlify/functions/
 *   (require("./novel-kb.json") — kedua-duanya mesti dalam folder yang sama)
 *
 * PEMBOLEH UBAH PERSEKITARAN (Netlify dashboard → Environment variables):
 *   GEMINI_API_KEY   (WAJIB — dari Google AI Studio. JANGAN dalam kod klien.)
 *   GEMINI_MODEL     (pilihan, default: gemini-2.5-flash — sahkan had kuota
 *                     percuma di AI Studio; kuota percuma TIDAK tanpa had.)
 *   ALLOWED_ORIGIN   (pilihan, hadkan CORS; default "*")
 *
 * DUA MOD:
 *   Mod Novel   — soalan tentang novel → pra-penapis petikan, 3 lapisan label,
 *                 setiap petikan disahkan terhadap novel-kb.json SEBELUM paparan.
 *   Mod Umum    — soalan luar novel → dijawab Gemini biasa, TIADA suntikan
 *                 petikan novel, dengan penafian ringkas. Tidak dipaksa novel.
 *
 * PRIVASI: hanya 5–7 petikan berkaitan dihantar ke Gemini (bukan keseluruhan
 * manuskrip). Pada tier percuma Gemini, data yang dihantar mungkin digunakan
 * Google untuk memperbaiki produk — notis ini dipaparkan di UI.
 * ------------------------------------------------------------------
 */

const KB = require("./novel-kb.json");

const STOPWORDS = new Set(
  ("yang di dan ke dari kepada dengan untuk adalah ini itu akan telah sudah bagi juga atau tetapi maka kerana sehingga ketika apabila apa bagaimana mengapa boleh bolehkah saya aku kau kamu kita mereka ia dia nya lah pun lah lagi sangat terlalu hanya sudah belum pernah akan mahu hendak dapat kepada dalam pada atas bawah antara melalui selepas sebelum ketika serta serta dan atau tidak ya bukan apakah bagaimana mengapa siapa mana berapa the a an of to in on at for and or is are was were be been it this that with by from as not we you they he she i my your their his her its what which who how why when where can could would should do does did have has had but if so such no yes akan patut harus perlu mungkin jangan boleh ada lagi macam cara sangat terlalu sekali").split(/\s+/)
);

// Kata kunci pengesan Mod Novel (termasuk tajuk 8 bahagian + tema)
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

function corsHeaders(origin) {
  const allow = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function termsOf(text) {
  return text.toLowerCase().replace(/[^a-zà-ÿ\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/* ------- Pengelas mod: kos sifar, tanpa panggilan API tambahan ------- */
function classifyMode(question, history) {
  const q = question.toLowerCase();
  for (const kw of NOVEL_KEYWORDS) if (q.indexOf(kw) !== -1) return "novel";
  // soalan susulan pendek selepas mod novel → kekal novel
  const last = history && history[history.length - 1];
  if (last && last.role === "assistant" && question.length < 60) return "novel";
  return "general";
}

/* ------- Pra-penapis kos-sifar ------- */
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
  return null; // tidak disahkan → JANGAN papar sebagai petikan sebenar
}

const rl = new Map();
function rateLimited(ip) {
  const now = Date.now(), WIN = 60000, MAX = 12;
  const e = rl.get(ip);
  if (!e || now - e.start > WIN) { rl.set(ip, { count: 1, start: now }); return false; }
  e.count++;
  return e.count > MAX; // usaha-terbaik — tidak kukuh merentas instance serverless
}

async function callGemini({ apiKey, model, system, contents, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, responseMimeType: "application/json" }
      }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally { clearTimeout(to); }
}

exports.handler = async (event) => {
  const origin = event.headers && (event.headers.origin || event.headers.Origin);
  const H = corsHeaders(origin);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Method not allowed" }) };

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: H, body: JSON.stringify({ error: "Bad JSON" }) }; }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const question = String(payload.question || "").trim().slice(0, 1000); // HAD INPUT — disemak dahulu
  if (!payload.probe && !question) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "Soalan kosong" }) };

  // PROBE — lakukan panggilan Gemini MINI sebenar supaya status "bersambung" bermakna
  if (payload.probe) {
    if (!apiKey) return { statusCode: 503, headers: H,
      body: JSON.stringify({ ok: false, error: "GEMINI_API_KEY belum ditetapkan di Netlify environment variables." }) };
    try {
      await callGemini({ apiKey, model, system: "Sah sahaja.", contents: [{ role: "user", parts: [{ text: "ok" }] }], maxTokens: 8 });
      return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, mode: "live", model }) };
    } catch (e) {
      const code = e && e.status;
      const msg = code === 429 ? "Kuota percuma Gemini dicapai / API key tidak sah (429)." :
                  code === 400 ? "Kekunci API tidak sah atau model tidak tersedia (400)." :
                  code === 404 ? "Model tidak tersedia atau nama GEMINI_MODEL salah (404). Semak senarai model di AI Studio." :
                  "Tidak dapat menghubungi Gemini API dari fungsi (rangkaian / masa tamat). Cuba lagi.";
      return { statusCode: 502, headers: H, body: JSON.stringify({ ok: false, error: msg, status: code || null }) };
    }
  }

  if (!apiKey) return { statusCode: 503, headers: H,
    body: JSON.stringify({ error: "Backend belum dikonfigurasi: GEMINI_API_KEY tiada dalam environment variables Netlify." }) };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "").split(",")[0].trim()) || "unknown";
  if (rateLimited(ip)) return { statusCode: 429, headers: H,
    body: JSON.stringify({ error: "Had penggunaan sementara dicapai (cuba lagi dalam seminit). Kawalan sisi pelayan usaha-terbaik." }) };

  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const mode = classifyMode(question, history);
  const geminiContents = history
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, 1000) }] }))
    .concat([{ role: "user", parts: [{ text: question }] }]);

  try {
    let data, picked = [], excerptCount = 0;
    if (mode === "novel") {
      picked = selectExcerpts(question);
      excerptCount = picked.length;
      const excerptBlock = picked.map((e, i) => `[${i + 1}] (${e.section}) ${e.text}`).join("\n");
      data = await callGemini({ apiKey, model, system: SYS_NOVEL + "\n\nEXCERPTS (satu-satunya petikan yang boleh anda kutip):\n" + excerptBlock, contents: geminiContents, maxTokens: 900 });
    } else {
      data = await callGemini({ apiKey, model, system: SYS_GENERAL, contents: geminiContents, maxTokens: 600 });
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

    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        mode: "live", aiMode: replyMode, model,
        reply: parsed.reply || "",
        quotes: safeQuotes,
        disclaimer: (parsed.disclaimer ? parsed.disclaimer + " " : "") + privacy +
          (finishReason && finishReason !== "STOP" ? ` [Catatan: Gemini tamat dengan status ${finishReason}.]` : "") +
          (dropped ? ` [${dropped} petikan tidak disahkan terhadap sumber dan tidak dipaparkan.]` : ""),
        usage: data.usageMetadata || null
      })
    };
  } catch (err) {
    if (err && err.name === "AbortError") return { statusCode: 504, headers: H,
      body: JSON.stringify({ error: "Sambungan ke Gemini tamat masa (20 saat). Cuba lagi atau tukar GEMINI_MODEL kepada model yang lebih pantas." }) };
    if (err && err.status === 429) return { statusCode: 429, headers: H,
      body: JSON.stringify({ error: "Kuota Gemini API dicapai (429). Had percuma harian mungkin habis (reset tengah malam Waktu Pasifik) atau kadar terlalu tinggi. Cuba lagi nanti, atau tukar GEMINI_MODEL." }) };
    return { statusCode: 502, headers: H,
      body: JSON.stringify({ error: `Gagal menghubungi Gemini API (status ${err && err.status || "sambungan"}).` }) };
  }
};
