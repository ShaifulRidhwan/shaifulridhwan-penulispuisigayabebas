"use strict";
// Studio Antara awareness is informational only. No automatic navigation and
// no image-generation request is executed by this text-chat handler.
const STUDIO_URL="https://shaifulridhwan-penulispuisigayabebas.netlify.app/studio-antara.html";
function imageRequest(question){
 const q=String(question||"").toLowerCase().trim();
 if(!q||q.length>1500)return false;
 // Discussing, quoting, negating or debugging image generation isn't an
 // instruction to create an image.
 if(/\b(?:jangan|tak perlu|tidak mahu|bukan|without|don't|do not)\b.{0,45}\b(?:jana|gambar|imej|generate|image|lukis)/i.test(q))return false;
 if(/^(?:apa|kenapa|mengapa|macam mana|bagaimana|terangkan|jelaskan|explain|how|why|what|tulis|karang|ringkaskan|translate|terjemah|bincang|semak|audit)\b/i.test(q))return false;
 const action=/(?:\b(?:jana(?:kan)?|hasilkan|ciptakan?|generate|generste|generete|genarate|render|lukiskan?|create|draw|buat(?:kan)?|make)\b)/i;
 const visual=/\b(?:imej|gambar|image|picture|foto|photo|ilustrasi|illustration|visual|poster)\b/i;
 return action.test(q)&&visual.test(q);
}
function studioQuestion(question){
 return /(?:^|\b)(?:studio antara|studio jana imej|studio.*(?:gambar|imej)|(?:di mana|kat mana|mana|where).{0,32}(?:jana gambar|jana imej|generate image))\b/i.test(String(question||""));
}
function localReply(question,{hasAttachment=false}={}){
 // Direct image creation requests get a reliable link, never a fabricated image.
 if(hasAttachment||!imageRequest(question))return null;
 return {
  reply:"Untuk jana gambar, Aksara ada **Studio Antara**. Kau boleh gunakan penerangan gambar tadi sebagai prompt di sana. Aku masih boleh bantu susun atau perkemas prompt dalam chat ni. 🎨🖼️",
  studioHint:true
 };
}
const SYSTEM_GUIDANCE="STUDIO ANTARA: Aksara mempunyai Studio Antara (studio-antara.html) untuk MENJANA GAMBAR menggunakan sistem imej yang berasingan. Bilik Antara ialah ruang perbualan; apabila pengguna mahu generate gambar, jelaskan kewujudan Studio Antara dan berikan pautan jika sesuai, tetapi JANGAN berpindah halaman secara automatik. Boleh bantu merangka prompt di chat. Jangan dakwa chat teks sudah menjana imej atau video jika alat tidak digunakan.";
module.exports={STUDIO_URL,imageRequest,studioQuestion,localReply,SYSTEM_GUIDANCE};
