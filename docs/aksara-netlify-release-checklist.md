# AKSARA · Panduan release Netlify

Dokumen operasi untuk memisahkan **pemeriksaan kod di GitHub** daripada **pemeriksaan laman yang benar-benar sudah dideploy**.

## Sebelum deploy
1. Pastikan semua perubahan yang ingin dilancar sudah di `main`, bukan sekadar di branch/PR.
2. Pastikan ujian GitHub Actions relevan berjaya; jika ada kegagalan, baca langkah yang gagal, bukan simpulkan semua ciri rosak.
3. Rekod SHA commit `main` sebagai titik rollback. Jangan guna `git reset --hard` atau `force push` pada `main`.
4. Jangan aktifkan semula laluan Android owner-QA atau gabungkan eksperimen router 3+1 tanpa semakan berasingan.
5. Semak kredit/build limit Netlify benar-benar sudah tersedia mengikut kitaran bil akaun. Reset bukan bukti deploy telah bermula.

## Selepas Netlify berjaya deploy
1. Dalam Netlify, semak **Deploys → Published deploy** dan pastikan commit SHA sepadan dengan `main`.
2. Buka `/`, `/bilik-antara.html`, `/studio-antara.html`, `/perpustakaan-aksara.html` dan `/antara-cahaya-dan-gelap.html` pada telefon dan desktop. Refresh jika perlu.
3. Semak paparan glass/blur, animasi, navigasi, arkib, pembaca novel, tema dan paparan mudah alih. Jangan tukar reka bentuk sebagai jalan pintas.
4. Dalam GitHub **Actions → Studio Antara Browser Audit → Run workflow**, pilih `main` dan tandakan **verify_production = true**. Langkah ini membandingkan fail produksi dengan repo dan menjalankan ujian frontend tanpa menggunakan kuota inferens imej.
5. Jika mahu, jalankan **Bilik Antara Production Smoke** secara manual. Semak pilihan yang menggunakan kuota API sebelum mencubanya. Semakan sebenar Gemini/Groq/Cloudflare memerlukan konfigurasi secret Netlify yang sah.
6. Semak halaman katalog dalam `sitemap.xml` dan meta canonical selepas deploy.

## Jika deploy gagal
- Bezakan ralat **build**, **konfigurasi secret**, **kuota provider**, **stale asset/cache** dan **fungsi/UI**.
- Jangan dedahkan API keys, bearer token, gambar pengguna atau sejarah chat dalam log, screenshot atau issue awam.
- Pulihkan deploy Netlify yang diketahui berfungsi, atau hasilkan *revert commit* untuk perubahan yang benar-benar menyebabkan masalah.
- Kegagalan parity terhadap produksi sebelum deploy ialah perbezaan versi, bukan bukti kod `main` tidak berfungsi.

## Mengapa semakan parity dibuat secara manual?
`main` boleh berubah ketika Netlify build pause. Ujian browser tempatan mesti tetap berjalan pada setiap perubahan berkaitan, manakala **production parity** hanya masuk akal selepas Netlify menerbitkan commit yang sama. Ujian Studio local, Lighthouse dan ujian keselamatan tidak dimatikan.
