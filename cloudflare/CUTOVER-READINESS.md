# AKSARA Cloudflare: pemeriksaan deployment pertama

Status: **pratonton migrasi**. Jangan ubah URL laman utama Netlify atau merge PR #127 berdasarkan build berjaya sahaja.

## Sambungan Git

- Worker: `aksara-apps`.
- Repository: `ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas`.
- Production branch Cloudflare sementara: `feature/cloudflare-aksara-apps-migration-20261031`.
- Build command: `npm ci && node cloudflare/build.mjs`.
- Deploy command: `npx wrangler deploy --config cloudflare/wrangler.jsonc`.
- Preview command: `npx wrangler preview --config cloudflare/wrangler.jsonc`.
- Root: `/`. Auto-builds enabled.

## Ujian deployment pertama

Semak `Workers & Pages → aksara-apps → Deployments/Builds` dan log `wrangler deploy` sebelum menganggap deploy berjaya.

Di alamat Worker yang Cloudflare beri, semak:

1. `/bilik-antara.html` memuatkan CSS, latar, animasi, fon dan kotak chat asal.
2. `/studio-antara.html` memuatkan preset, glass UI, dan History. Tanpa secrets, fungsi AI memang belum boleh digunakan.
3. `/perpustakaan-aksara.html`, `/antara-cahaya-dan-gelap.html`, serta `/assets/novel/pembaca.html` memuatkan ilustrasi dan alat pembaca asal.
4. `/` menghantar ke laman utama Netlify.
5. HTML migrasi mengandungi `noindex`; canonical URL asal Netlify belum diubah.
6. Tanpa Cloudflare runtime secrets, Chat/Voice/Studio gagal secara terkawal, tidak membocorkan keys dan tidak memanggil provider berbayar.
7. Selepas secrets dipasang secara peribadi, jalankan smoke test Chat probe, mesej, streaming, semua 3+1 providers, token Voice Live, Perkemas AI dan penjanaan imej.
8. Semak CPU Worker Free, Durable Object quota/leases dan had model sebenar sebelum berpindah penuh.

## Secrets dan keselamatan

Jangan masukkan `GEMINI_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, atau `AKSARA_RATE_SALT` ke repository, binaan awam, screenshot atau chat.

Set secrets menggunakan tetapan runtime Worker (bukan sahaja variable untuk build). Jangan buka laluan Studio AI sebelum kawalan Durable Object dan quota disahkan. Token API Cloudflare yang digunakan oleh GitHub Builds bukan token model imej dan tidak menggantikan runtime secrets.

## Peraturan cutover

Sahkan production Cloudflare dengan ujian browser sebenar sebelum mengubah pautan dari laman utama Netlify. Kekalkan fungsi dan URL Netlify yang sedia ada sebagai rollback. Jangan anggap localStorage atau IndexedDB sesi lama berpindah antara origin secara automatik.
