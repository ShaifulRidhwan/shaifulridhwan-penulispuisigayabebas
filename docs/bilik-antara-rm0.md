# Bilik Antara RM0 — Implementasi dan Batasan

Tarikh: 26 Oktober 2026.

## Ciri telah dibina
- Memori yang pengguna aktif dan sunting sendiri, disimpan setempat.
- Arkib sesi tanpa had bilangan buatan aplikasi, carian, pin, padam serta eksport Markdown dan JSON. Memerlukan pilihan simpan sesi; tertakluk pada ruang storan pelayar.
- Ruang kerja untuk menyunting draf, menyalin dan eksport Markdown.
- Tindakan pada jawapan: salin, ringkaskan, semak dakwaan, belajar berperingkat dan salin ke draf.
- Statistik token, bilangan respons dan masa respons, hanya pada peranti.
- Tiada had bilangan lampiran buatan aplikasi; gabungan media sehingga kira-kira 3.6 MB dalam satu permintaan kerana had payload Netlify 6 MB.
- Voice Live menerima konteks sembang teks; transkrip dipindahkan ke sejarah hanya dengan persetujuan.
- Aliran teks sebenar melalui Netlify Functions dan Gemini SSE untuk sembang biasa, dengan sandaran backend asal bagi soalan rumit.
- Semakan fakta/logik secara terpilih dan pemilihan tahap pemikiran, bukan pada semua jawapan.
- Rujukan ensiklopedia Wikimedia tanpa kunci berbayar untuk topik umum dan permintaan sesuai.
- Pembelajaran berperingkat melalui arahan pintar. Rekod keputusan latihan jangka panjang belum ada.
- Penyelesaian masalah bertahap. Belum menjadi agen autonomi yang boleh menggunakan komputer atau mengubah akaun luar.

## Had buatan yang dibuang dan batas sebenar

- Ruang mesej tidak lagi mempunyai maxlength 1,600 aksara; pelayan menolak input melebihi kira-kira 32,000 aksara dengan mesej jelas, bukannya memotongnya senyap.
- Sejarah perbualan yang dipilih untuk disimpan tidak lagi dipadam selepas 14 hari atau dipotong pada 44/80 mesej. Konteks yang dihantar kepada model masih dipilih daripada mesej terkini dan ringkasan supaya tidak memenuhi kuota token.
- Tiada had 15 sesi atau 50,000 aksara pada draf setempat. Had fizikal storan pelayar masih berkuat kuasa.
- Had bilangan lampiran dibuang. Had gabungan data dan saiz setiap permintaan ialah perlindungan teknikal untuk Netlify, bukan caj tambahan.
- Memori pilihan boleh menyimpan sehingga 8,000 aksara konteks untuk setiap permintaan.
- Kawalan anti-spam, tempoh token Voice Live, saiz fungsi, dan kuota Google/Netlify kekal. Kod tidak boleh menjadikan API luar benar-benar tanpa had.

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

### Ketahanan dan konteks (28 Oktober 2026)

- Chat mencuba `bilik-antara-stream` (NDJSON) dengan handler, identiti dan penghalaan yang sama seperti API JSON. HTTP 404/405/501 beralih ke API JSON sebelum ada jawapan; ralat model tidak menghantar permintaan pendua.
- Gemini dan penyedia sandaran mengalirkan teks untuk tugasan tanpa alat/semakan kedua. Tugasan dengan alat atau semakan lengkap dipulangkan selepas pemprosesan. Bingkai penamat diperlukan; sambungan terputus tidak dianggap lengkap dan tidak disambung dengan teks penyedia lain.
- `Henti` membatalkan permintaan pelayar dan meneruskan isyarat pembatalan ke panggilan model apabila runtime menyokongnya. Jawapan separa yang dihentikan pengguna ditandakan, bukan dianggap lengkap. Ini bukan jaminan pembatalan bil di penyedia.
- Had satu permintaan utama ialah kira-kira 28 saat, dengan sandaran berkongsi baki masa. Had pelayar 34 saat. Penyedia yang menolak model/akses juga boleh beralih kepada sandaran teks yang layak; tiada pengaktifan model berbayar.
- Sejarah maksimum 24 mesej / 120,000 aksara; maksimum 32,000 aksara setiap mesej. Apabila terpaksa dipendekkan, awal dan penutup dikekalkan dengan penanda. Ringkasan sehingga 4,000 aksara. Ini masih konteks terhad, bukan ingatan tanpa had.
- Fail mentah kekal dalam memori tab untuk soalan susulan sehingga dibuang, sesi ditukar atau tab ditutup. Arkib tidak menyimpan fail mentah; pengguna perlu melampirkannya semula selepas membuka sesi tersimpan.
- Memori pilihan dan fail teks hanya layak ke penyedia sandaran selepas checkbox berasingan dalam **Privasi & sesi** dipilih. Media, fungsi carian/pautan dan kes sensitif masih memerlukan laluan yang menyokongnya. Kekurangan keupayaan dijelaskan, bukan dilabel semua model sibuk.
- Status awal menunjukkan **AI dikonfigurasi**; hanya ujian sebenar atau respons berjaya mengesahkan sambungan. Statistik turut memisahkan masa teks pertama streaming daripada masa keseluruhan. Kejayaan teknikal tidak membuktikan ketepatan jawapan.
- Fail `bilik-antara-brain.js` dan `bilik-antara-identity.js` dikekalkan; keseluruhan arahan personaliti turut dihantar ke sandaran tanpa potongan 18,000 aksara yang lama.

Ujian luar talian: `node --test scripts/test-aksara-reliability.cjs`.
