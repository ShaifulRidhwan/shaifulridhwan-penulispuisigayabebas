# AKSARA Cloudflare: pemeriksaan deployment pertama

Status: **migrasi bertahap**. Kod PR #127 dan pembetulan sesi PR #128 sudah di-merge ke `main`; laman utama Netlify kekal dan pautan Bilik Antara pada laman utama kini menuju Worker Cloudflare. Deployment dan ujian live Cloudflare mesti disahkan secara berasingan.

## Sambungan Git

- Worker: `aksara-apps`.
- Repository: `ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas`.
- Production branch Cloudflare yang ditetapkan melalui Dashboard: `main` (1 November 2026).
- Jika branch baru ditukar, Cloudflare tidak semestinya membina semula commit lama. Push baharu ke `main` boleh mencetuskan Workers Builds automatik apabila integrasi Git dan build diaktifkan.
- Build command: `npm ci && node cloudflare/build.mjs`.
- Deploy command: `npx wrangler deploy --config cloudflare/wrangler.jsonc`.
- Preview command: `npx wrangler preview --config cloudflare/wrangler.jsonc`.
- Root: `/`. Auto-builds enabled.

## Pengesahan cutover selepas push ke main

1. Buka `Workers & Pages → aksara-apps → Deployments` dan pastikan ada build baharu daripada `main` selepas push/merge terkini.
2. Buka `https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara.html` dan sahkan HTML memuatkan `bilik-antara-session-utils.js?v=2` serta `bilik-antara-suite.js?v=15`.
3. Semak `https://aksara-apps.mshaifulridhwan.workers.dev/bilik-antara-session-utils.js?v=2` mengandungi helper `matchArchivedSession` dan `conversationTitle`.
4. Uji `GET /api/aksara-health`, Chat, NDJSON streaming, Studio dan Voice secara terkawal. Jangan menganggap HTTP 200 bagi HTML membuktikan backend berjaya.
5. Arkib Netlify dan Cloudflare berbeza origin: eksport JSON di URL Netlify lama, kemudian import di Cloudflare. Jangan padam storage pengguna atau hidupkan teknologi tambahan yang belum disediakan.

Ujian live sebelumnya (1 November, 10:55 MYT) menemui frontend Cloudflare masih menggunakan versi lama `v1` dan `v14`, walaupun Netlify sudah menghala ke Cloudflare. Jadi pengesahan versi selepas deployment wajib dilakukan.

## Ujian deployment pertama

Semak `Workers & Pages → aksara-apps → Deployments/Builds` dan log `wrangler deploy` sebelum menganggap deploy berjaya.

Di alamat Worker yang Cloudflare beri, semak:

1. `/bilik-antara.html` memuatkan CSS, latar, animasi, fon dan kotak chat asal.
2. `/studio-antara.html` memuatkan preset, glass UI, dan History. Tanpa secrets, fungsi AI memang belum boleh digunakan.
3. `/perpustakaan-aksara.html`, `/antara-cahaya-dan-gelap.html`, serta `/assets/novel/pembaca.html` memuatkan ilustrasi dan alat pembaca asal.
4. `/` menghantar ke laman utama Netlify.
5. HTML migrasi mengandungi `noindex`; canonical URL asal Netlify belum diubah.
6. Tanpa Cloudflare runtime secrets, Chat/Voice/Studio gagal secara terkawal, tidak membocorkan keys dan tidak memanggil provider berbayar.
7. Pastikan Workers AI mempunyai binding `AI` serta model `@cf/zai-org/glm-4.7-flash` menjawab secara sebenar, bukan sekadar `Ready`. Kemudian jalankan smoke test Chat, streaming, token Voice Live, Perkemas AI dan penjanaan imej.
8. Semak CPU Worker Free, Durable Object quota/leases dan had model sebenar sebelum berpindah penuh.

## Secrets dan keselamatan

Jangan masukkan `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, atau `AKSARA_RATE_SALT` ke repository, binaan awam, screenshot atau chat.

Set secrets menggunakan tetapan runtime Worker (bukan sahaja variable untuk build). Jangan buka laluan Studio AI sebelum kawalan Durable Object dan quota disahkan. Token API Cloudflare yang digunakan oleh GitHub Builds bukan token model imej dan tidak menggantikan runtime secrets.

## Peraturan cutover

Pautan Bilik Antara pada Netlify sudah dihalakan ke Cloudflare melalui PR #128; jangan ubah laluan itu lagi tanpa QA. Kekalkan URL Bilik Antara Netlify lama untuk pemulihan/eksport arkib. Canonical dan `noindex` Cloudflare sengaja belum ditukar. Jangan anggap localStorage atau IndexedDB sesi lama berpindah antara origin secara automatik.
