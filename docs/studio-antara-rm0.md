# Studio Antara · Cloudflare Workers AI

## Apa yang digunakan sekarang

Studio Antara ialah halaman **jana imej melalui REST API Cloudflare Workers AI**. Model pertama ialah **FLUX.1 Schnell** (`@cf/black-forest-labs/flux-1-schnell`). Pengunjung tidak memasang enjin GPU atau memuat turun model besar. Backend memproses API menggunakan Netlify Function `netlify/functions/studio-image.js`.

Video belum diaktifkan. Tab "Jana Video" hanyalah penerangan fasa akan datang, tanpa panggilan API dan tanpa mendakwa video berjaya dihasilkan.

## Tetapan rahsia Netlify

- `CLOUDFLARE_ACCOUNT_ID` : Account ID daripada Cloudflare
- `CLOUDFLARE_API_TOKEN` : token Workers AI dengan kebenaran yang diperlukan

Token tidak disalurkan ke browser. Jangan menyimpan kunci API dalam fail JS atau commit. Persekitaran deployment mesti mempunyai kedua-dua pemboleh ubah tersebut.

## Aliran aplikasi

1. `studio-antara.html` memuat gaya ringan `studio-antara.css` dan `studio-antara-cloud.js`.
2. Browser menghantar prompt, pilihan gaya, langkah 4/8 dan seed kepada `/.netlify/functions/studio-image`.
3. Netlify mengesahkan saiz/jenis input, Origin, format, had percubaan asas serta tetapan rahsia.
4. Backend meminta Cloudflare Workers AI menjana imej.
5. Cloudflare memulangkan imej JPEG dalam base64. Browser memaparkan hasil menggunakan Blob URL dan menyediakan simpan fail.
6. Keputusan tidak disimpan dalam pangkalan data. Pengguna boleh menyimpan imej pada peranti mereka.

## Had, kos dan keselamatan

Cloudflare Workers AI mempunyai alokasi Neurons percuma harian yang dikongsi semua panggilan pada akaun. Kualiti 8 langkah memerlukan lebih pemprosesan berbanding 4 langkah. Pada pelan Free, Cloudflare boleh menolak permintaan selepas kuota habis. **Jangan andaikan jumlah imej percuma harian sentiasa sama**; lihat dashboard Cloudflare untuk penggunaan sebenar.

Netlify Function mengehadkan saiz prompt, menyekat parameter tidak dikenali, menetapkan masa tamat, dan mempunyai had asas berdasarkan IP serta bilangan permintaan serentak dalam **satu instance**. Had ini bukan had global yang kekal antara instance; bagi laman dengan trafik tinggi, gunakan Turnstile dan storan had global sebelum membuka trafik awam berskala besar.

Jangan beri token API kepada pengguna. Fungsi video tidak berkongsi token atau penggunaan fungsi imej.

## Pembersihan versi terdahulu

Fail aplikasi penjanaan setempat yang tidak lagi digunakan dipadam daripada repositori. Studio baharu juga cuba menghapuskan cache model lama menggunakan nama cache tepat dan membatalkan pendaftaran service worker model lama sahaja, tanpa menyentuh cache atau service worker fungsi website lain. Perubahan ini hanya berkesan pada peranti yang melawat Studio selepas deployment baharu.

## Ujian

Jalankan:

`node --test scripts/test-studio-antara.cjs`

Ujian setempat memeriksa HTML, JavaScript, validasi backend serta simulasi respons Cloudflare. Ia **tidak membuktikan** akaun Cloudflare benar-benar dapat menjana imej. Ujian end-to-end memerlukan deployment Netlify yang mempunyai dua environment variable dan kuota Workers AI yang tersedia.

Langkah smoke selepas deploy:
- Buka Studio pada Android dan desktop, pastikan tiada muat turun model.
- Jana imej dengan arahan ringkas dan sahkan hasil JPEG serta butang simpan.
- Uji gaya, 4/8 langkah, seed dan mesej kuota.
- Pastikan Bilik Antara dan Voice Live tidak berubah.
