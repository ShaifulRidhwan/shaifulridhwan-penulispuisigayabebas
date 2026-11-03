# AKSARA Thinking Architecture 3.0 | CAHAYA, GELAP dan Dual Perspective

Status: implementasi dalam branch/PR. Dua mod ini ialah **gaya respons dengan perancangan adaptif**, bukan dua model, dua otak, atau paparan private chain-of-thought.

## Skop 6+1

| Ciri | Apa yang dibuat | Batas sebenar |
|---|---|---|
| Cognitive Depth Engine 2.0 | Penghalaan tahap low/medium/high ikut task dan isyarat kompleks; persoalan ringkas dengan perkataan 'manusia' tidak automatik High | Heuristik deterministik, bukan pemahaman sempurna |
| Argument Integrity Engine | Tugas kritik memeriksa dakwaan, andaian, bukti dan bantahan terkuat | Arahan berkaitan tugas, bukan fact checker automatik |
| Cross-Mode Continuity | Ikut sejarah dan pembetulan yang dihantar; gaya boleh berubah tetapi fakta kekal | Tiada memori silang sesi atau pengekalan baharu |
| Anti-Sycophancy 3.0 | Teguran/bukti baharu mencetuskan semakan pendirian, bukan setuju atau bantah secara automatik | Dapat mengesan isyarat, bukan pengesahan kebenaran |
| Evidence-Aware Thinking | Bezakan bukti teks halaman, snippet dan tiada akses; disepadukan dengan audit sumber v5 | Padanan teks **bukan** semakan kebenaran fakta |
| Dual-Mode Evaluation Lab | 58 soalan offline, 116 perancangan mod; A/B live pilihan dengan provider dan model sebenar | Ujian offline tidak mengukur ketepatan; penggredan manusia masih diperlukan |
| Dual Perspective | Pengguna meminta dua sudut, sistem menjawab CAHAYA dan GELAP dalam satu respons | Satu panggilan model; bukan dua inferens bebas atau mod ketiga |

## Contoh permintaan pengguna

- "Cuba lihat dari kedua-dua sudut: adakah menambah model AI meningkatkan kecerdasan?"
- "Jawab dari sudut CAHAYA dan GELAP: wajarkah strategi ini?"
- "Beri dua perspektif tentang hujah ini."

Jika tidak diminta secara jelas, mod terpilih kekal mengawal respons. Sekadar menyebut 'cahaya dan gelap' dalam puisi **tidak** mengaktifkan Dual Perspective. Prompt sensitif/support tidak menjalankan format dual secara automatik.

## Polisi sumber dan privasi

- Kedua-dua mod menggunakan sejarah, routing 3+1, identiti dan alat yang sama; kecuali analisis dan nada, tiada kelebihan alat tersembunyi.
- Sumber belum dibaca sepenuhnya apabila hanya snippet muncul. Tool Google/Groq/Tavily perlu menunjukkan bukti penggunaan sebenar; sistem tidak mendakwa membaca URL tanpa pengesahan.
- Sejarah chat boleh mengandungi pertukaran mod. Arahan baru tidak membatalkan fakta lama tanpa pembetulan atau bukti baharu. Tiada pangkalan memori baru.
- GeminI Voice Live dan voice token, model, tempo serta pilihan Aoede tidak diubah. Tiada penggandaan panggilan API automatik untuk Dual Perspective.
- Rekod status menampilkan hanya versi, depth dan metadata bukti; bukan teks private reasoning atau nota pengguna.

## Ujian / kriteria penerimaan

1. `npm run test:aksara-thinking-v3` untuk ujian tersasar.
2. `npm run test:aksara-platform` untuk regresi mod, provider, keupayaan dan privasi.
3. `npm run benchmark:aksara:thinking-v3` untuk 58 soalan offline (116 perancangan). **Bukan** penggredan model.
4. GitHub Bilik Antara Tests, Identity Regression, Site Quality dan Cloudflare preview mesti hijau pada HEAD PR.
5. QA manual: soalan mudah 'Kenapa manusia tidur?', kritik hujah yang benar dan salah, susulan 'maksud aku', tanpa sumber, dan pertukaran mod selepas pembetulan.
6. Ujian live hanya selepas pengguna bersetuju menggunakan kuota. Set `AKSARA_THINKING_V3_EVAL_URL=https://.../.netlify/functions/bilik-antara`; kemudian `node scripts/aksara-thinking-benchmark-v3.cjs --live --confirm-quota --count=3 --output=aksara-thinking-v3-private.json`.
7. CLI menghantar dua permintaan bagi setiap soalan, maksimum 10 pasang. Perbandingan hanya sah apabila provider+model sepadan dan hasil dinilai manusia. Fail mengandungi jawapan; jangan commit.

## Rollback

Revert PR Thinking v3 jika regresi; tiada perubahan kepada empat key Gemini, Voice Live, default memori OFF, OpenRouter free fallback atau Studio. CI hijau tidak membuktikan Netlify production deploy terkini sudah disiarkan. Periksa SHA deploy dan uji sendiri.
