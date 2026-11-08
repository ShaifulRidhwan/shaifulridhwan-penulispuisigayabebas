# GAYA BEBAS

### Shaiful Ridhwan | The Coder Poet

**Aksara Moden untuk Hari Ini, Aksara Kuno Bila Perlu.**

Gaya Bebas ialah ruang sastera, falsafah dan teknologi yang dibangunkan oleh **Shaiful Ridhwan**, penulis puisi gaya bebas dari Malaysia.

Bermula dengan aksara dan persoalan tentang manusia, projek ini berkembang menjadi sebuah platform yang menggabungkan penulisan kreatif, programming dan Artificial Intelligence.

Di sini, puisi bukan sekadar tentang perasaan. Ia juga tentang akal, pengetahuan, kewujudan dan keberanian untuk terus bertanya.

---

## ✍️ GAYA BEBAS | Sastera & Falsafah

Ruang untuk meneroka puisi Melayu moden, karya bersiri, novel dan penulisan falsafah.

Antara kandungannya:

- **Puisi Gaya Bebas:** Karya tentang cinta, manusia, akal, iman dan kewujudan.
- **Duologi, Trilogi & Tetralogi:** Eksperimen struktur dan kesinambungan idea dalam penulisan puisi.
- **Antara Cahaya dan Gelap:** Novel prosa falsafah yang meneroka kehidupan di antara dua kutub pemikiran.
- **Perpustakaan AKSARA:** Ruang membaca novel dan sastera falsafah pilihan.

## 🤖 BILIK ANTARA | Aksara A.I.

**Aksara A.I.** ialah projek AI yang dibina untuk berbual, belajar, menulis, melakukan analisis dan meneroka persoalan. Ia menggunakan gaya Bahasa Melayu Malaysia santai, dengan English technical terms apabila sesuai.

Di belakang Aksara terdapat empat AI providers:

**Google Gemini · Groq · Cloudflare Workers AI · OpenRouter**

Sistem teks ini menggunakan **AI routing**, **fallback management**, **context handling** dan dua mode perbualan:

- **CAHAYA:** Santai, praktikal dan jelas.
- **GELAP:** Lebih kritis, analitikal dan berfalsafah.

**Polisi chat 3+1:** Gemini, Groq dan Cloudflare Workers AI ialah tiga penyedia utama, manakala **OpenRouter free** ialah sandaran terakhir. Chat berusaha menggunakan Gemini apabila dikonfigurasi dan sesuai, tetapi aliran carian web atau pelaksanaan kod mungkin menggunakan alat Groq terlebih dahulu. Routing bergantung pada kesihatan, tugas, had masa dan persetujuan pengguna; ini bukan jaminan setiap permintaan menggunakan Gemini. Imej hanya dihantar ke sandaran dengan izin jelas. **Gemini Voice Live kekal laluan berasingan.** Penilaian kualiti berpandukan manusia dalam v5 adalah *opt-in* dan OFF secara lalai, tidak dianggap terbukti tanpa ujian live.

Keempat-empat AI providers tidak semestinya aktif serentak. Status sambungan sebenar bergantung pada konfigurasi API, availability dan quota. `Ready` bukan bermaksud `Connected`.

**Penambahbaikan Intelligence v5:** audit dakwaan berasaskan petikan (bukan pengesahan kebenaran automatik), keputusan sesi sementara, panduan sastera, metrik satu instance, pemulihan diagnostik, audit multimodal dan penilaian live dengan izin. Kawalan kadar berpusat memerlukan Redis REST yang dikonfigurasi secara pilihan. [Dokumentasi v5](docs/AKSARA-INTELLIGENCE-V5.md) menerangkan had, ujian, suis dan rollback.

## 🎨 STUDIO ANTARA | AI Image Generation

**Studio Antara** ialah ruang kreatif untuk menghasilkan imej melalui AI.

Ia menggabungkan **prompt refinement**, **visual presets** dan **image generation** dalam satu interface, tanpa pengguna perlu memasang model AI pada peranti sendiri.

Studio Antara berasingan daripada chat teks Bilik Antara. Aksara boleh membantu pengguna menyediakan prompt dan memperkenalkan Studio, tetapi tidak mendakwa imej dijana dalam chat tanpa menggunakan alat imej sebenar.

## 💻 THE CODER POET

Sebelum Gaya Bebas berkembang menjadi platform sastera dan AI, Shaiful pernah aktif dalam komuniti Android development melalui **XDA Developers**.

Antara eksperimennya ialah **kernel modification**, **performance optimization**, **overclocking** dan projek **Twister Kernel**.

Daripada debugging code kepada menyunting puisi, pendekatannya masih berlegar pada perkara yang sama: memahami struktur, menguji kemungkinan dan mencari batas sesuatu sistem.

> **“Dulu aku debug code. Sekarang aku debug diri sendiri.”**

## ⚙️ TECHNOLOGY STACK

Platform ini dibangunkan menggunakan:

- HTML5, CSS3 & JavaScript
- Netlify & Serverless Functions
- Google Gemini, Groq & OpenRouter APIs plus native Cloudflare Workers AI binding
- Cloudflare Workers AI untuk fungsi image generation
- GitHub & GitHub Actions
- AI routing, context management & fallback systems

## MANIFESTO

Puisi gaya bebas bukan bermaksud menulis tanpa pertimbangan.

Kebebasan memberi ruang untuk memilih bentuk. Pemikiran menentukan arah. Bahasa pula menjadi tempat kedua-duanya bertemu.

**GAYA BEBAS bukan sekadar cara menulis. Ia juga cara melihat dunia.**

---

© 2026 Shaiful Ridhwan. Hak cipta karya asli terpelihara.

Semua puisi, tulisan asli dan kandungan kreatif yang diterbitkan oleh Shaiful Ridhwan dilindungi oleh hak cipta yang berkenaan, kecuali jika dinyatakan sebaliknya.


### AKSARA Thinking Architecture 3.0

CAHAYA dan GELAP berkongsi fakta, routing, alat dan privasi. Thinking Depth menyesuaikan soalan ringkas berbanding hujah mendalam; penilaian dua mod menggunakan benchmark offline dan ujian live opt-in. Untuk melihat dua sudut dalam satu respons, taip **"Cuba lihat dari kedua-dua sudut: ..."** atau **"Jawab dari sudut CAHAYA dan GELAP: ..."**. Dual Perspective bukan mod ketiga atau dua panggilan API. Panduan: [Thinking Architecture 3.0](docs/AKSARA-THINKING-ARCHITECTURE-V3.md).


### AKSARA Reliability & Quality v6

Permintaan sesi dibaca dengan pengesanan pembetulan terkini, error recovery diperjelas, dan benchmark live kini menggunakan sampling berstrata. Selain itu tersedia output-budget adaptif berpilihan, telemetry agregat rentas instance melalui Redis berpilihan, profil mutu provider berpandukan semakan manusia dan 20 ujian struktur sastera. **Tiada pilihan berkuota dihidupkan automatik**, dan ujian offline tidak membuktikan mutu model live. Panduan: [Reliability & Quality v6](docs/AKSARA-RELIABILITY-QUALITY-V6.md).


### Sesi & Memori Integrity v2

Arkib kini ditulis dengan semakan versi terkini bagi mengurangkan konflik tab, sesi asal dipulihkan selepas reload, editor memori dilindungi daripada kehilangan draf, dan tindakan OFF disahkan sebelum memadam sejarah. Kedua-duanya kekal default ON untuk tetapan baharu, sementara OFF yang disimpan sebelum ini dihormati. [Baca audit dan had teknikal](docs/AKSARA-SESSION-MEMORY-INTEGRITY-V2.md).
