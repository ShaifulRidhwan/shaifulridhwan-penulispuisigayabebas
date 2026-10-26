# Audit prestasi dan pengalaman — 26 Oktober 2026

## Skop
Hanya `index.html` (Gaya Bebas) dan `bilik-antara.html` (Bilik Antara), serta aset/skrip berkaitan.
Fail novel, manuskrip dan enjin Gemini tidak diubah.

## Kaedah dan had
- Chromium / Playwright, simulasi desktop 1440×900 dan telefon 390×844 (mobile emulation).
- Ujian carian 33 puisi, enam pilihan editorial, penapis kategori, pautan dalaman, accordion, navigasi papan kekunci, menu hamburger, tema, penyediaan mesej, kawalan suara.
- Pemeriksaan HTTP 200 dan paparan asas untuk kedua-dua halaman produksi Netlify.
- Lighthouse 12.6, data makmal. Skor berbeza mengikut rangkaian, peranti dan larian; ini bukan data CrUX pelawat sebenar.
- Sesi Voice Live sebenar, penghantaran mesej Gemini berbayar dan papan kekunci fizikal telefon tidak diuji dalam audit ini.

## Baseline produksi sebelum pembetulan
| Halaman | Mod | Prestasi | Aksesibiliti | Best Practices | SEO | LCP |
|---|---|---:|---:|---:|---:|---:|
| Laman utama | Desktop | 98 | 98 | 100 | 100 | 0.8 s |
| Laman utama | Mobile | 91 | 98 | 100 | 100 | 2.8 s |
| Bilik Antara | Desktop | 97 | 95 | 100 | 100 | 1.0 s |
| Bilik Antara | Mobile | 79 | 95 | 96 | 100 | 4.2 s |

## Makmal tempatan selepas pembetulan
| Halaman | Mod | Prestasi | Aksesibiliti | Best Practices | SEO |
|---|---|---:|---:|---:|---:|
| Laman utama | Desktop | 99 | 100 | 100 | 100 |
| Laman utama | Mobile | 92 (berbeza sekitar 91–92 mengikut larian) | 100 | 100 | 100 |
| Bilik Antara | Desktop | 98 | 100 | 96 | 100 |
| Bilik Antara | Mobile | 78 (berbeza sekitar 78–79 mengikut larian) | 100 | 96 | 100 |

`Best Practices` dalam makmal Bilik Antara dipengaruhi ralat tempatan 501 untuk fungsi Netlify yang tidak wujud pada pelayan statik ujian; ia tidak membuktikan ralat produksi.

## Isu terbukti dan tindakan
1. **Menu mobile tersembunyi**. Peraturan `.hamburger { display:none }` dari gabungan CSS menindih peraturan telefon. Ditambah pembetulan responsif di penghujung CSS. Ujian telefon kini lulus.
2. **Hierarki tajuk melompat** daripada h2 ke h4 untuk manifesto dan maklumat penulis. Ditukar kepada h3, dan selector CSS dikemas kini bagi mengekalkan rupa. Aksesibiliti laman utama makmal kini 100.
3. **ARIA salah** pada label lampiran Bilik Antara dan nama aksesibiliti pautan jenama tidak sepadan dengan teks. Dibaiki. Aksesibiliti Bilik Antara makmal kini 100.
4. **Teks kecil mobile** (8–11 px) pada nota dan kawalan Bilik Antara. Saiz minimum 12 px ditetapkan untuk kawalan dikenal pasti, dengan touch target minimum 40 px.
5. **Favicon Bilik Antara** ditambah menggunakan SVG sedia ada supaya pelayar tidak mencari favicon lalai.
6. **Pemuatan fon**. Dua permintaan Google Fonts digabungkan tanpa mengubah keluarga fon. Percubaan memuatkan CSS fon secara tidak menyekat dibatalkan kerana tiada peningkatan prestasi terukur.

## Lulus
- 33 puisi boleh dipaparkan; 6 pilihan editorial dan penapis kategori berfungsi.
- Carian, reset, senarai tajuk statik dan navigasi papan kekunci berfungsi.
- Pertukaran tema, menu telefon, kawalan mesej Bilik Antara berfungsi di Chromium.
- Tiada overflow mendatar pada kedua-dua resolusi ujian.
- Pautan dalaman yang diperiksa tidak mempunyai sasaran fail hilang (pautan novel dikecualikan mengikut skop).
- HTTP 200 produksi untuk laman utama dan Bilik Antara, dengan 6 karya pilihan serta kawalan chat dipaparkan.

## Belum selesai / risiko yang kekal
- LCP Bilik Antara mobile sekitar 4.2 saat pada baseline produksi; sebahagian masa menunggu paparan tajuk berkaitan fon web. Belum ada pembetulan berkesan yang dibuktikan dalam Lighthouse.
- Font keluarga berganda dan CSS Bilik Antara yang besar masih berpotensi menjadi beban. Jangan menukar rekaan visual tanpa ujian A/B atau bukti lebih kuat.
- Ujian papan kekunci maya Android sebenar, Voice Live mikrofon-ke-pembesar suara, kebolehgunaan pembaca skrin dan sambungan Gemini tidak termasuk dalam audit ini.
- Pautan luar (TikTok, GitHub, blog) tidak disahkan secara menyeluruh kerana perkhidmatan mungkin menolak bot HEAD; audit hanya mengesahkan pautan dalaman dan respons halaman produksi.

Laporan tersimpan dalam GitHub bersama skrip `scripts/browser-audit.cjs` dan workflow `.github/workflows/browser-performance-audit.yml`.
