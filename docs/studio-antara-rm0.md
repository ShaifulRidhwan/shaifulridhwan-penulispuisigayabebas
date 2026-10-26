# Studio Antara RM0 — Pembetulan keselamatan muat turun dan Imej AI BETA TEST

**26 Oktober 2026.** Dua halaman ringan:

- `studio-antara.html`: e-mel serta PDF/Word sahaja. Fungsi jadual, graf dan poster telah **dibuang** daripada antaramuka dan skrip utama.
- `studio-imej-beta.html`: eksperimen imej AI **BETA TEST** dalam halaman berasingan. Tiada SDK atau muat turun model dipasang di halaman Studio biasa.

## Studio utama

E-mel mempunyai editor, draf Gemini (tertakluk kuota RM0), eksport .eml, salin dan buka aplikasi e-mel tanpa menghantar e-mel secara automatik. Dokumen mempunyai editor, draf Gemini, cetak sebagai PDF melalui pelayar, eksport HTML serta DOCX melalui pustaka sumber terbuka yang dimuat apabila pengguna meminta. Jawapan daripada Bilik Antara masih boleh dipindahkan ke Studio melalui butang Studio, menggunakan sessionStorage.

## Imej AI BETA TEST

**Mengapa diasingkan?** Brave Android memaparkan “Aw, Snap!” ketika model besar dimuat. Kejadian ini konsisten dengan risiko tab kehabisan memori tetapi screenshot sahaja bukan bukti mutlak punca crash. SD-Turbo memerlukan beberapa fail ONNX sekitar **2.34 GiB** untuk dimuat dan kemudian disediakan pada GPU. Pemindahan model ke Cache Storage kini dipisahkan daripada inisialisasi runtime GPU.

Peringkat:
1. Semak jenis peranti, WebGPU API, RAM yang didedahkan pelayar dan anggaran kuota storan. Tiada SDK besar dimuat ketika halaman dibuka.
2. Dapatkan persetujuan sebelum muat turun 2.34 GiB. Butang muat turun biasa menggunakan `fetch` dan `Cache.put` untuk menyimpan setiap fail lengkap dalam Cache Storage tanpa `arrayBuffer()` yang memperuntuk keseluruhan fail pada JavaScript.
3. Pilihan **Background Fetch** sebenar dengan service worker hanya diaktifkan jika API pelayar menyokongnya. Jika tidak, jangan berjanji boleh terus memuat turun selepas tab ditutup.
4. **Sambung semula** bermaksud guna semula komponen model yang sudah lengkap disimpan. Komponen yang terputus mungkin dimuat turun sekali lagi; tiada sokongan sambung pada aras bait yang dijanjikan.
5. Selepas tiga fail model selesai, pengguna desktop WebGPU yang layak boleh cuba mengaktifkan model dan menjana imej 512 × 512, lalu menyimpan PNG.

**Android:** muat turun biasa model boleh dicuba pada telefon selepas persetujuan pengguna, walaupun anggaran kuota storan tidak diketahui atau rendah. Pelayar mungkin gagal menyimpan fail 2.34 GiB atau tab mungkin crash; ini dipaparkan sebagai risiko dan ralat sebenar. Cache menyimpan komponen lengkap untuk cubaan seterusnya. Background Fetch hanya muncul jika disokong pelayar. Pengaktifan GPU untuk inferens berat masih dikawal secara berasingan pada Android supaya muat turun tidak terus mencetuskan pemprosesan model.

**Keselamatan dan privasi:** tiada API penjana imej berbayar; model/pustaka dimuat daripada sumber luar selepas persetujuan. Pengurusan cache hanya menyentuh tiga URL ONNX SD-Turbo dalam cache `web-txt2img-v1`, tanpa memadam data laman lain. Muat turun latar boleh dihentikan dan persetujuan boleh ditarik balik. Muat turun dan memori adalah perbelanjaan data/storan/perkakasan peranti pengguna, bukan kapasiti tanpa had.

## Fail terlibat

- `studio-antara.html`, `studio-antara.js`, `studio-antara.css`
- `studio-imej-beta.html`, `studio-imej-beta.css`, `studio-imej-beta.js`
- `studio-imej-config.js` (manifes URL model tepat), `studio-imej-sw.js` (Background Fetch sahaja)
- `scripts/test-studio-antara.cjs`
- Pautan Bilik Antara, AI backend dan sitemap dikemaskini.

## Ujian selepas Netlify deploy

1. Brave Android: masuk Studio tanpa crash; hanya E-mel dan PDF/Word, pautan Imej AI BETA TEST.
2. Brave Android: buka halaman imej, perhatikan status peranti dan bahawa muat turun biasa/GPU **disekat**. Jika Background Fetch tersedia, ia tetap perlu persetujuan dan storan cukup.
3. Desktop: uji dialog persetujuan, pemeriksaan storan, Cache Storage, muat turun satu fail, muat turun semula dan padam tiga fail model.
4. Pelayar yang menyokong Background Fetch: muat turun berjaya melalui service worker, buka semula halaman dan semak cache. Jika API tiada, butang muat turun latar tidak aktif.
5. Desktop WebGPU dan memori mencukupi: uji pengaktifan dan jana imej sebenar. Runtime pihak ketiga mungkin masih gagal.
6. Uji e-mel, cetak PDF serta eksport DOCX; pastikan fungsi lain kekal lancar.
7. Jalankan `node --test scripts/test-studio-antara.cjs` dan regresi Bilik Antara.

**Status pengesahan:** pengujian kod/mock membuktikan aliran kawalan setakat yang diuji. Ia **tidak** membuktikan peranti Brave atau GPU sebenar berjaya menjana imej atau Background Fetch disokong pada peranti pengguna. Label **BETA TEST** mesti kekal sehingga ujian lapangan lulus.
