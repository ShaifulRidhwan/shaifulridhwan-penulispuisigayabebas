# Studio Antara: kelompok RM0 dan Imej AI BETA TEST

Studio berada di studio-antara.html, dipaut dari Bilik Antara. Novel tidak diubah.

## Kelompok pertama
- E-mel: draf manual atau bantuan Gemini tier percuma; salin, .eml, atau buka aplikasi e-mel dengan mailto. Tiada penghantaran automatik.
- Dokumen: laporan, resume, surat, proposal dan nota. Pratonton, eksport HTML dan DOCX sebenar melalui docx.js yang dimuat apabila pengguna menekan eksport.
- PDF: fungsi cetak pelayar dengan gaya A4; pengguna memilih 'Save as PDF / Simpan sebagai PDF'. Tiada perkhidmatan PDF berbayar.
- Jadual: CSV dengan quoted fields, pratonton dan eksport CSV/JSON. Pratonton maksimum 1,000 baris; fail eksport masih mengandungi semua data.
- Graf: graf bar/garisan SVG dan PNG daripada data CSV, maksimum 100 rekod digraf untuk keterbacaan.
- Poster: 3 format dan 3 tema tipografi Canvas, eksport PNG. Poster bukan imej yang dijana oleh model AI.
- Butang Studio pada jawapan AI memindahkan teks ke draf melalui sessionStorage tanpa memasukkannya ke URL.

## Kelompok kedua: Imej AI BETA TEST
- Label BETA TEST jelas pada tab, notis, butang dan status output.
- Model imej dimuat hanya selepas pengguna menanda persetujuan dan menekan Muat model.
- Semak HTTPS, WebGPU dan Worker; jika gagal, beritahu keadaan sebenar tanpa imej palsu.
- Runtime web-txt2img versi 0.3.1 (MIT) dimuat dari CDN selepas persetujuan; model SD-Turbo menggunakan GPU peranti.
- Penjanaan sebenar menghasilkan Blob PNG untuk pengguna simpan. Tiada API imej berbayar.
- Muat turun model mungkin beberapa gigabait, dan WebGPU/Android tidak semestinya serasi.
- Hanya tiada kuota panggilan API imej apabila pemprosesan setempat berjaya. RAM, GPU, storan, data rangkaian dan elektrik tetap terhad.
- Perpustakaan/model dari sumber luar mungkin memerlukan sambungan CDN. Jangan hantar data sulit atau andaikan pemprosesan setempat bermaksud tiada sebarang hubungan rangkaian semasa pemuatan.
- Integrasi SD-Turbo belum lulus ujian produksi GPU/Android sebenar. BETA TEST bermaksud percubaan, bukannya fungsi dijamin.

## Ujian produksi
1. Buka Studio dari Bilik Antara, eksport jawapan AI ke Studio dan sahkan draf dipindahkan.
2. Cipta .eml dan buka aplikasi e-mel; pastikan tiada e-mel dihantar automatik.
3. Cetak surat sebagai PDF A4 melalui pelayar. Buka DOCX yang dieksport.
4. Uji CSV termasuk petikan berganda, graf SVG/PNG dan poster PNG pelbagai format.
5. Uji Android tanpa WebGPU dan desktop dengan WebGPU. Pastikan model tidak dimuat sebelum persetujuan.
6. Dengan WebGPU sebenar, cuba muat SD-Turbo, jana imej dan eksport PNG.
7. Jalankan test: node --test scripts/test-studio-antara.cjs

Kos sifar hanya bermaksud tiada perkhidmatan API tambahan. Bantuan menulis melalui Gemini tetap terikat kuota percuma.