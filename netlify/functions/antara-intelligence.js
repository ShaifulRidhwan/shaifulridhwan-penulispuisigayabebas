"use strict";
// Pure, testable helpers for Bilik Antara. No network calls or private data here.
const POEMS = require("../../karya-index.json");
const MODES = new Set(["bual", "bedah", "selidik"]);
const MODE_PROMPTS = {
  bual: "MOD BUAL: Mulakan dengan jawapan ringkas dan tepat. Jika topik berat, huraikan secukupnya. Santai dan bijak; bukan setiap soalan memerlukan kuliah.",
  bedah: "MOD BEDAH: Bina hujah yang jelas. Nyatakan premis, uji andaian, bentangkan bantahan yang kuat (steelman), timbang bukti dan buat rumusan yang tidak berpura-pura pasti. Jangan setuju membuta tuli.",
  selidik: "MOD SELIDIK: Dahulukan fakta yang boleh disemak. Gunakan Google Search apabila relevan, bezakan sumber daripada inferens, beritahu jika carian tidak menghasilkan sokongan. Jangan reka pautan atau petikan."
};
const WORD_SKIP = new Set(["yang","dan","untuk","pada","dalam","adalah","dengan","atau","aku","kamu","saya","tentang","apa","siapa","boleh","macam","bila","bukan","cari","puisi","karya","dari","daripada","sebuah","antara","tulis","nak","satu","paling","ini","itu","lagi","ada","saya","kau"]);
function safeMode(value) { return MODES.has(value) ? value : "bual"; }
function safeText(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function safeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-18).filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).map(m => ({role: m.role, content: safeText(m.content, 1600)}));
}
function thinkingFor(mode, question) {
  const q = question.toLowerCase();
  const deep = /mengapa|kenapa|buktikan|hujah|analisis|banding|pertentangan|kontradiksi|paradoks|falsafah|logik|algoritma|masalah|persamaan|kebebasan|reason|prove|compare|debug/.test(q) || q.length > 190;
  if (mode === "bedah") return "high";
  if (mode === "selidik") return "medium";
  return deep ? "medium" : "low";
}
function wantsMath(question) {
  return /(?:\d+\s*[+\-*/^×÷]\s*\d+|hitung|kira(?:kan)?|calculate|integral|derivative|terbitan|statistik|regresi|matriks|persamaan|equation|code execution|jalankan kod)/i.test(question);
}
function toolsFor(mode, question) {
  const tools = [];
  if (mode === "selidik" && process.env.ENABLE_SEARCH_GROUNDING !== "false") tools.push({google_search:{}});
  if (wantsMath(question) && process.env.ENABLE_CODE_EXECUTION !== "false") tools.push({code_execution:{}});
  return tools;
}
function poemMatches(question, limit = 3) {
  const q = safeText(question, 1600).toLowerCase();
  const tokens = [...new Set((q.match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length >= 3 && !WORD_SKIP.has(w)))].slice(0, 20);
  if (!tokens.length) return [];
  return POEMS.map(p => {
    const title = p.title.toLowerCase();
    const body = p.lines.join(" ").toLowerCase();
    let score = tokens.reduce((n,w) => n + (title.includes(w) ? 5 : 0) + (body.includes(w) ? 1 : 0), 0);
    if (q.includes(title)) score += 20;
    return {title:p.title, lines:p.lines, score};
  }).filter(p => p.score > 0).sort((a,b) => b.score - a.score).slice(0,limit);
}
function poemContext(question) {
  const matches = poemMatches(question);
  if (!matches.length) return "";
  const excerpts = matches.map(p => "TAJUK: " + p.title + "\nTEKS: " + p.lines.join("\n").slice(0, 1450)).join("\n\n");
  return "PETIKAN KARYA AWAM GAYA BEBAS (sumber: katalog index.html penulis). Petik hanya teks yang betul-betul wujud; jangan tambah baris atau atribusi:\n" + excerpts;
}
function sourceList(candidate) {
  const chunks = candidate && candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  return chunks.map(ch => ch && ch.web || {}).filter(w => {
    if (typeof w.uri !== "string" || !/^https?:\/\//i.test(w.uri) || w.uri.length > 1800 || seen.has(w.uri)) return false;
    seen.add(w.uri);
    return true;
  }).slice(0, 6).map(w => ({title: safeText(w.title, 140) || "Sumber", url:w.uri}));
}
function modelText(candidate) {
  const parts = candidate && candidate.content && candidate.content.parts || [];
  return parts.filter(p => p && typeof p.text === "string" && !p.thought).map(p => p.text).join("\n").trim();
}
function parseReply(text) {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string") return parsed.reply;
  } catch (_) {}
  return String(text).replace(/^```(?:json)?\s*|\s*```$/gi,"").trim();
}
module.exports = {MODE_PROMPTS,safeMode,safeText,safeHistory,thinkingFor,toolsFor,poemMatches,poemContext,sourceList,modelText,parseReply};
