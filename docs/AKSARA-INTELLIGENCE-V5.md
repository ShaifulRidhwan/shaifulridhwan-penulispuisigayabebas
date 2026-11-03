# AKSARA Intelligence v5 | Lapan peningkatan dan audit routing

**Status: candidate dalam PR.** Kod dan ujian sintetik bukan bukti model live sudah lebih tepat; telefon Android dan kuota sebenar memerlukan QA berasingan.

## Routing sebenar

- Chat menggunakan polisi **3+1**. Tiga penyedia utama: Gemini, Groq, Cloudflare Workers AI. OpenRouter/free kekal sandaran terakhir, bukan penyedia berbayar automatik.
- Apabila Gemini chat dikonfigurasi dan layak, laluan utama cuba Gemini; tugas carian atau pelaksanaan kod tertentu boleh mencuba alat Groq dahulu. Kesihatan, timeout, URL dan persetujuan pengguna boleh mengubah laluan.
- 4 slot key Gemini chat, cooldown, status dan model dipelihara. **Gemini Voice Live tidak disentuh.** Fallback imej memerlukan izin nyata. Memori/nota sesi tetap default OFF.
- Ranking kualiti v5 hanya menyusun **penyedia bukan-Gemini yang layak** dan tidak mengalihkan OpenRouter mendahului provider utama.

## Status komponen 1 hingga 8

| # | Komponen | Pelaksanaan | Had sebenar |
|---|---|---|---|
| 1 | Live Evaluation Lab | Bank 50 soalan Melayu dan CLI opt-in yang merekod provider/model sebenar | Manual human grading diperlukan; tidak automatik mengesahkan fakta |
| 2 | Evidence Verification | claimAudit memadankan dakwaan dengan teks/snippet sumber | Padanan kata ialah petunjuk, **bukan pengesahan fakta**; tiada sumber bermaksud belum disahkan |
| 3 | Quality Router | Bobot terkawal daripada laporan manusia yang diluluskan | Default OFF; perlu 10 sampel manusia setiap provider/tugas, tidak bergantung HTTP 200 |
| 4 | Session Decision Ledger | Pilih keputusan pengguna terkini mengikut topik dalam sejarah permintaan | Ephemeral, tiada storan baharu atau memori automatik |
| 5 | Global Quota Guard | Redis REST EVAL/INCR/EXPIRE atomik dengan HMAC salted IP | Memerlukan perkhidmatan transaksional luar; default OFF |
| 6 | Multimodal Accuracy Lab | Pemeriksaan kontrak OCR, lampiran, consent dan metadata | Ujian Chromium/Android serta gambar sebenar belum menggantikan ujian sintetik |
| 7 | Production Health & Recovery | Counters instance, status provider dan cadangan pemulihan error yang selamat | Bukan monitoring seluruh deployment, tidak ulang respons stream terputus automatik |
| 8 | Literary Intelligence | Kiraan rangkap, baris dan motif, arahan membedah struktur dan falsafah | Ciri statistik teks bukan penilaian mutu seni dan tidak mencipta petikan sumber |

## Suis keselamatan

- AKSARA_V5_QUALITY_ROUTER=true: aktif hanya apabila AKSARA_V5_HUMAN_QUALITY_JSON mempunyai version=1, approved=true dan sekurang-kurangnya 10 sampel bertanda humanReviewed=true serta grade antara 0 hingga 1 bagi setiap provider/tugas. Delta maksimum +/-8; tiada skor palsu atau pilihan model dipaksa.
- AKSARA_V5_GLOBAL_GUARD=true: memerlukan AKSARA_V5_REDIS_REST_URL (HTTPS domain upstash.io), AKSARA_V5_REDIS_REST_TOKEN (server-only), AKSARA_V5_RATE_SALT (rahsia >=24 aksara) dan pilihan AKSARA_V5_PER_MINUTE (contoh 12). Tiada data perbualan, lampiran atau raw IP dihantar. Hanya HMAC berasaskan alamat IP dipercayai.
- Apabila Redis tidak tersedia dan guard diaktifkan, permintaan AI ditolak fail-closed untuk melindungi kuota. Bila OFF, throttle instance dan shared daily-budget lama kekal. Netlify Blobs tidak menjamin transaksi atomik rentas instance.
- Jangan masukkan token, Redis credentials atau nota memori dalam commit / hasil ujian awam.

## Arahan ujian

1. Jalankan npm run test:aksara-v5 dan npm run test:aksara-platform, kemudian semak Bilik Antara Tests pada PR yang sama.
2. Jalankan node scripts/aksara-multimodal-lab-v5.cjs. Ujian itu kontrak OFFLINE, bukan ujian kamera atau ketepatan OCR.
3. Jalankan node scripts/aksara-evaluation-live-v5.cjs tanpa argumen untuk melihat manifest tanpa menggunakan API.
4. Jika pemilik mahu menggunakan kuota, set AKSARA_V5_EVAL_URL kepada endpoint chat Netlify yang sebenar dan jalankan: node scripts/aksara-evaluation-live-v5.cjs --live --confirm-quota --count=5 --output=aksara-v5-private-eval.json. Fail ini mengandungi jawapan model, jangan commit.
5. Semak setiap rekod provider/model sebenar; --prefer=groq hanyalah petunjuk fallback, bukan jaminan model dipilih. Tambah skor manusia hanya selepas menilai ketepatan, bukti, keselamatan dan kesinambungan sesi.
6. Uji OCR PDF imbasan dengan izin pada Android sebenar; visual graph, screenshot dan metadata fail sebenar. Sahkan sesi baharu dan sesi lama.
7. Uji rollback konfigurasi: matikan kedua-dua suis V5, semak GPT text, status, Voice Live, imej dan Studio Antara kekal berjalan.
8. Semak commit SHA yang dipublish di Netlify sebelum mendakwa produksi berjaya. CI hijau tidak membuktikan deploy sudah berlaku.

## Kriteria merge dan rollback

Merge hanya selepas syntax, unit dan test projek hijau pada HEAD PR. Ujian live API/Android perlu diberi status berasingan jika tidak dilaksanakan. Sekiranya regresi, revert PR dan kembalikan suis V5 OFF; jangan force-push main. Semua label metrik perlu jelas sama ada offline, satu instance, live atau dinilai manusia.
