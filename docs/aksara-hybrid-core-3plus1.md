# AKSARA | Intelligent Core 3+1
Teras teks: **Gemini, Groq, Cloudflare Workers AI**; sandaran akhir **OpenRouter/free**.
- Gemini: tools, media, pautan dan Gemini Live. Voice Live kekal di Gemini.
- Groq: laluan teks pantas jika model dan kuota benar-benar tersedia.
- Cloudflare Workers AI: model `@cf/zai-org/glm-4.7-flash` melalui native `env.AI` binding, tanpa key model di frontend. Pakej prompt sama untuk semua penyedia, identiti AKSARA, sejarah sembang, CAHAYA/GELAP dan tugasan. Workers AI untuk teks sahaja, bukan lampiran.
- OpenRouter: sandaran teks terakhir; kekalkan pilihan imej hanya dengan izin jelas pengguna.
- Pemilihan berdasarkan kesesuaian tugas, bukti jawapan berjaya dan kesihatan, bukannya nama model. Jangan dakwa semua Connected apabila sekadar konfigurasi Ready.
- Streaming SSE hanya diteruskan selepas delta kandungan. Jika streaming sudah bermula dan gagal, hentikan dengan ralat, jangan campur jawapan model lain.
- Jaga kuota Workers AI yang berkongsi neurons dengan Studio, kawalan per-IP/per-hari di Durable Object, dan had provider. Jika AI binding belum tersedia, fail closed dengan fallback yang tersedia.
- Netlify main tidak disentuh sehingga smoke test Cloudflare preview dan review asal selesai.
