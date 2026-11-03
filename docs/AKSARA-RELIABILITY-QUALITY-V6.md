# AKSARA Reliability & Quality v6 | Skop 4–8 dan tiga penemuan audit

## Ruang lingkup yang dilaksanakan

**Tiada ciri 1 (production parity) atau 2 (Live Intelligence Quality Benchmark penuh) dilaksanakan dalam PR ini.** Skop ini meliputi cadangan 4–8 dan tiga kelemahan yang ditemui dalam audit kod. Live testing dan penilaian mutu sebenar kekal memerlukan izin dan laporan yang belum tersedia.

| # | Komponen | Kod sebenar | Apa yang TIDAK terbukti |
|---|---|---|---|
| 4 | Context Consistency v6 | Penanda pembetulan terbaru, susulan bernombor dan kesinambungan mod melalui sejarah dalam permintaan sahaja; ujian 12 senario sintetik | Bukan memori silang sesi atau jaminan model tidak tersilap |
| 5 | Response Efficiency v6 | Penganggar token kasar, laporan meta dan had output berpilihan untuk soalan pendek risiko rendah | Tiada bukti pengurangan kos atau latency live lagi |
| 6 | Failure Recovery v6 | Panduan kod ralat yang disanitasi, Retry-After, pemeliharaan input dan perlindungan stream terputus | Tidak membuat auto-retry baharu atau memintas quota |
| 7 | Production Observability v6 | Pilihan agregat rentas instance menggunakan Redis REST; laporan pemilik yang membina statistik daripada bucket | Tiada central log tersedia tanpa Redis/konfigurasi; p50/p95 ialah anggaran bucket |
| 8 | Literary Reasoning Benchmark v6 | 20 contoh Melayu untuk rangkap, baris, motif dan harness live opt-in | Tidak mengesahkan pemahaman metafora/falsafah secara automatik |

## Tiga penemuan yang ditangani

1. **Bias sampling dalam Evaluation Lab**: `aksara-evaluation-live-v5.cjs` dan `aksara-thinking-benchmark-v3.cjs` kini menggunakan pemilihan berstrata mengikut task. Sampel kecil tidak lagi semuanya kategori `explain`. Latihan live masih perlu kuota dan penggredan manusia.
2. **Kualiti provider berdasarkan bukti**: profil berasingan v6 mengelompokkan `provider + model + task`, memerlukan sekurang-kurangnya 10 contoh *unik* berlabel `humanReviewed` dan `evidenceReviewed`, dan memerlukan kelulusan eksplisit. Registry kekal mengutamakan provider utama sebelum OpenRouter. Profil belum tersedia untuk produksinya.
3. **Counters warm instance tidak mencukupi**: Redis mencatat hanya kelas HTTP, provider yang diketahui, mod dan bucket latency. Ia tidak menyimpan prompt, URL, IP, token, jawapan, imej atau sejarah chat. Counters asal pada status masih dilabel `one-warm-instance`.

## Konfigurasi, kos dan privasi

- `AKSARA_V6_RESPONSE_EFFICIENCY=true`: ON hanya apabila owner sudah menguji kualiti respons pendek. Default **OFF**. Optimasi mengehadkan `maxTokens` output untuk soalan pendek aras low sahaja, bukan memotong dokumen, sejarah atau system prompt. Tugas research, creative, complex, sensitif, data peribadi, attachment, JSON, Dual Perspective dan review tidak terjejas.
- `AKSARA_V6_QUALITY_ROUTER=true`: memerlukan `AKSARA_V6_QUALITY_PROFILE_JSON` daripada fail penilaian manusia yang disahkan. Default **OFF**. V5 Legacy Quality Router masih wujud; gunakan hanya satu versi pada satu masa. Kunci perbandingan mesti padan dengan model live sebenar.
- `AKSARA_V6_TELEMETRY=true`: memerlukan **secret server** `AKSARA_V5_REDIS_REST_URL` dan `AKSARA_V5_REDIS_REST_TOKEN`, endpoint HTTPS Upstash yang sah. Default **OFF**. Kegagalan Redis **tidak** boleh menjejaskan chat, sebaliknya metrik hilang. Penyimpanan menggunakan TTL 48 jam dan agregat hari UTC, tanpa data identiti peribadi.
- Redis ialah perkhidmatan luar dan mungkin tertakluk kuota/had; semak dahulu sebelum aktifkan. Jangan letakkan credential dalam README, issues atau chat.
- Pengumpulan tidak berlaku bagi status/probe berjaya; permintaan yang memberi jawapan atau error direkod secara agregat. Bucketing tidak menilai kualiti respons model.
- Audit konsistensi sesi ialah request-only. Memori/nota tetap default OFF dan izin untuk menghantar lampiran kepada penyedia lain kekal seperti sediakala.

## Ujian tanpa kuota API

```sh
npm run test:aksara-v6
npm run test:aksara-platform
npm run benchmark:aksara:v6:context
npm run benchmark:aksara:v6:literary
node scripts/aksara-evaluation-live-v5.cjs
node scripts/aksara-thinking-benchmark-v3.cjs
```

## Ujian live pilihan

Untuk benchmark sastera yang menggunakan kuota sebenar, sediakan `AKSARA_V6_LITERARY_EVAL_URL` dalam mesin peribadi, kemudian jalankan:

```sh
node scripts/aksara-literary-benchmark-v6.cjs --live --confirm-quota --count=3
```

Gunakan `AKSARA_V5_EVAL_URL` atau `AKSARA_THINKING_V3_EVAL_URL` untuk harness live lama yang kini menggunakan sampling berstrata. Uji beberapa kali dengan provider dan model yang sama apabila membuat perbandingan. HTTP 200, tempo atau gaya puitis bukan skor ketepatan. Jangan siar rekod jawapan peribadi.

## Penilaian manusia dan quality gating

Sediakan fail JSON peribadi berbentuk array item `{id,provider,model,task,humanReviewed:true,evidenceReviewed:true,grade:0.85}` berdasarkan **respons sebenar yang diperiksa manusia**. Pastikan ID unik untuk setiap kes, provider+model sebenar, dan skor 0 hingga 1 berdasarkan rubrik yang konsisten. Ketepatan dan bukti mesti dinilai, bukan panjang jawapan.

```sh
node scripts/aksara-quality-profile-v6.cjs --input=private-reviews.json --output=private-profile.json --approve
```

Jangan aktifkan env Quality Router jika tiada sekurang-kurangnya 10 kes unik bagi kategori yang hendak diberi skor; sampel kosong atau tidak disahkan dikembalikan kepada pemilihan sedia ada.

## Ops report peribadi

```sh
npm run report:aksara:v6
node scripts/aksara-ops-report-v6.cjs --date=2026-11-03
```

Ops report membaca kiraan kumpulan bagi hari UTC melalui Redis peribadi dan **tidak** diekspos pada route web awam. `latencyP50Band` dan `latencyP95Band` ialah kelompok kiraan, bukannya percentile tepat; jangan melabelnya sebagai latency real-time keseluruhan pengguna jika telemetry belum diaktifkan.

## Keperluan sebelum merge/deploy

1. Semua CI bertanda hijau pada SHA yang sama. Jangan sebut live quality verified jika ujian hanya deterministik.
2. Pastikan routing Gemini/3+1, Voice Live, Studio, GDPR/privasi, sesimu dan memori OFF tidak diubah.
3. Default ketiga-tiga flag v6 OFF. Ops read bukan dashboard awam dan tiada secrets dalam frontend.
4. QA manual selepas Netlify deploy: pembetulan terbaru, susulan 'yang kedua', CAHAYA/GELAP, link tanpa sumber, imej consent, 429, timeout, sesi lama dan baharu.
5. Deployment parity dengan `main` ialah fasa berasingan, bukan dibuat oleh PR ini.

## Rollback

Matikan semua `AKSARA_V6_*` flag dahulu jika isu timbul; untuk regression aktif Context/Recovery, revert PR v6. Jangan force-push `main` dan jangan mengusik Gemini Live yang sudah stabil.
