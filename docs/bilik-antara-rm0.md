# Bilik Antara RM0 — Implementasi dan Batasan

Tarikh: 26 Oktober 2026.

## Ciri telah dibina
- Memori yang pengguna aktif dan sunting sendiri, disimpan setempat.
- Arkib sehingga 15 sesi, carian, pin, padam serta eksport Markdown dan JSON. Memerlukan pilihan simpan sesi.
- Ruang kerja untuk menyunting draf, menyalin dan eksport Markdown.
- Tindakan pada jawapan: salin, ringkaskan, semak dakwaan, belajar berperingkat dan salin ke draf.
- Statistik token, bilangan respons dan masa respons, hanya pada peranti.
- Sehingga tiga lampiran sekali gus dan had gabungan media 2.1 MB.
- Voice Live menerima konteks sembang teks; transkrip dipindahkan ke sejarah hanya dengan persetujuan.
- Aliran teks sebenar melalui Netlify Functions dan Gemini SSE untuk sembang biasa, dengan sandaran backend asal bagi soalan rumit.
- Semakan fakta/logik secara terpilih dan pemilihan tahap pemikiran, bukan pada semua jawapan.
- Rujukan ensiklopedia Wikimedia tanpa kunci berbayar untuk topik umum dan permintaan sesuai.
- Pembelajaran berperingkat melalui arahan pintar. Rekod keputusan latihan jangka panjang belum ada.
- Penyelesaian masalah bertahap. Belum menjadi agen autonomi yang boleh menggunakan komputer atau mengubah akaun luar.

## Had RM0 yang mesti dijelaskan

- Google Search Grounding dimatikan sepenuhnya dalam edisi ini. Gemini 3.6 Flash tidak menawarkan Google Search API grounding pada tier percuma.
- Model teks hanya dipilih daripada model Gemini yang mempunyai tier API percuma.
- Code Execution dan URL Context digunakan jika tersedia. Rujukan Wikimedia ialah rujukan ensiklopedia, bukan penyelidikan web mendalam atau berita masa nyata.
- Kod tidak boleh menjamin kos sifar apabila akaun API atau Netlify dihubungkan dengan pengebilan. Pemilik perlu mengekalkan Google AI pada Free Tier tanpa billing dan memantau had percuma Netlify.
- Tiada perkhidmatan cloud database atau analitik berbayar; perbualan/memori/ruang kerja disimpan dalam pelayar. Gunakan fungsi padam pada peranti berkongsi.
- Permintaan dihantar kepada Gemini dan tertakluk kepada terma privasi Google; jangan hantar rahsia.
- Setiap fungsi mungkin terjejas oleh kuota, had platform dan perubahan API. Ujian integrasi produksi tetap perlu.

## Fail terlibat

Backend: netlify/functions/bilik-antara.js, antara-intelligence.js, antara-free-research.js dan bilik-antara-stream.mjs.

Frontend: bilik-antara.html, bilik-antara-suite.js, bilik-antara-suite.css dan bilik-antara-voice.js.

Novel dan fail pembacanya tidak diubah.

## Ujian selepas deploy

1. Pastikan Netlify memaparkan fungsi bilik-antara, bilik-antara-stream dan bilik-antara-live-token.
2. Cuba mesej ringkas: streaming sepatutnya berfungsi atau jatuh balik kepada endpoint utama.
3. Cuba soalan rumit dan beberapa lampiran serentak.
4. Aktifkan simpan sesi. Cipta dan tukar sesi, kemudian cari, pin, eksport serta padam.
5. Nyahaktifkan simpan sesi dan pastikan arkib setempat hilang. Padam memori melalui panel.
6. Cuba Voice Live dan pemindahan transkrip secara sukarela.
7. Uji drawer alat pada desktop dan Android.
8. Jalankan: node --test scripts/test-bilik-antara.cjs
9. Semak panggilan Gemini dan Netlify sebenar; ujian sintaks/mock bukan bukti sambungan produksi.

Status: fail dikomit ke main, ujian mock dan sintaks lulus; status deployment sebenar belum disahkan.
