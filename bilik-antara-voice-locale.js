(function(root){
"use strict";
/*
 * Bilik Antara Voice language/dialect preferences.
 * Gaya bahasa is a prompt-level preference, NOT a guaranteed TTS accent.
 * No microphone data, account data or API keys are stored here.
 */
const STORAGE_KEY="bilik-antara:voice-dialect:v1";
const DEFAULT="santai";
const STYLES=Object.freeze({
 santai:Object.freeze({
  label:"Bahasa Melayu santai",
  guide:"Guna Bahasa Melayu Malaysia santai dan mudah faham. Guna aku/kau. Bunyi seperti perbualan biasa di Malaysia; elakkan ayat skema, bahasa baku yang kaku dan gaya bahasa Indonesia."
 }),
 perak:Object.freeze({
  label:"Perak",
  guide:"Gaya percakapan Melayu Perak yang mesra. Boleh gunakan 'teman' atau 'mike' pada tempat yang sesuai, tetapi Perak mempunyai banyak variasi daerah. Guna unsur loghat secara sederhana dan pastikan maksud jelas, jangan pura-pura meniru semua pelat Perak."
 }),
 kelantan:Object.freeze({
  label:"Kelantan",
  guide:"Gunakan gaya Melayu Kelantan yang mesra dan mudah difahami. Boleh selitkan 'kawe', 'demo' atau 'gapo' apabila sesuai. Jangan paksa setiap perkataan bertukar dialek, jangan jadikan loghat sebagai bahan lawak, dan kekalkan maksud yang tepat."
 }),
 penang:Object.freeze({
  label:"Pulau Pinang",
  guide:"Gunakan gaya Melayu Pulau Pinang utara yang santai. Ungkapan seperti 'hang', 'mai', 'depa' dan 'sat' boleh diselitkan secara semula jadi jika sesuai. Elakkan keterlaluan, jangan campurkan loghat lain secara rambang."
 }),
 kedah:Object.freeze({
  label:"Kedah",
  guide:"Gunakan gaya Melayu Kedah yang mesra dan tidak dibuat-buat. Boleh guna 'hang', 'awat' dan 'satgi' secara berpatutan bila sesuai. Kekalkan Bahasa Melayu yang mudah difahami; jangan jadikan percakapan karikatur."
 }),
 sabah:Object.freeze({
  label:"Sabah",
  guide:"Gunakan gaya Melayu Sabah yang santai dan hormat kepada variasi tempatan. Boleh selit 'bah', 'sia' atau 'nda' pada tempat yang sesuai, tanpa menganggap semua orang Sabah bercakap sama. Utamakan ayat Melayu yang jelas."
 }),
 sarawak:Object.freeze({
  label:"Sarawak",
  guide:"Gunakan sedikit gaya Melayu Sarawak yang santai. Boleh guna 'kamek', 'kitak', 'sik' dan 'tok' apabila sesuai dengan maksud. Sarawak pelbagai bahasa dan dialek; jangan campur kosa kata secara rawak atau buat-buat pelat."
 })
});
function normalize(code){
 return Object.prototype.hasOwnProperty.call(STYLES,code)?code:DEFAULT;
}
function displayName(code){return STYLES[normalize(code)].label;}
function instruction(code){
 const style=STYLES[normalize(code)];
 return [
  "LANGUAGE LOCK FOR ALL GENERATED SPEECH AND RESPONSES: RESPOND ONLY IN MALAY, SPECIFICALLY COLLOQUIAL MALAYSIAN MALAY (Bahasa Melayu Malaysia, ms-MY). YOU MUST RESPOND UNMISTAKABLY IN MALAY ON EVERY TURN. NEVER SWITCH TO SPANISH, ENGLISH, INDONESIAN, OR ANY OTHER LANGUAGE.",
  "PERATURAN WAJIB: Dari mula sampai akhir setiap respons audio, bercakap dalam Bahasa Melayu Malaysia SAHAJA. Walaupun pengguna guna perkataan Inggeris, bahasa Sepanyol, terjemahan, atau sebutan kurang jelas, jawapan dan penjelasan mesti dalam Bahasa Melayu Malaysia. Nama khas atau istilah teknikal asing boleh disebut sekadar perlu di dalam ayat Melayu, bukan menukar bahasa keseluruhan.",
  "Jangan mengikut bahasa salah yang mungkin dikesan secara automatik daripada audio. Jangan meniru bahasa latar, radio, muzik atau suara orang lain. Jika kurang jelas, jawab dalam Melayu: 'Boleh ulang? Aku tak dengar jelas tadi.'",
  "GAYA BAHASA PILIHAN PENGGUNA: "+style.label+". "+style.guide,
  "Loghat ini variasi gaya kata dan intonasi yang cuba diikuti, bukan jaminan pelat asli penutur tempatan. Jangan paksa perkataan loghat yang tidak pasti. Kejelasan maksud dan Bahasa Melayu Malaysia tetap paling utama.",
  "Jangan terjemah jawapan ke bahasa lain. Kekal sebagai pembantu Shaiful Ridhwan A.I. dan gunakan aku/kau secara semula jadi."
 ].join(" ");
}
function read(storage){
 try{return normalize(storage?.getItem(STORAGE_KEY));}catch(_){return DEFAULT;}
}
function save(code,storage){
 const value=normalize(code);
 try{storage?.setItem(STORAGE_KEY,value);}catch(_){}
 return value;
}
const api=Object.freeze({DEFAULT,STYLES,STORAGE_KEY,normalize,displayName,instruction,read,save});
if(root)root.BilikAntaraVoiceLocale=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null);
