# AKSARA Skills Engine v1 | 7 November 2026

## Audit asas
Aksara sudah mempunyai `cognitiveProfile`, Research Workflow, Safe Tools, Knowledge Engine, Thinking v4, dan Quality Evidence v6. Mencipta prompt kedua yang besar akan menduplikasi protokol asal. Skills v1 ialah **lapisan prosedur khusus** yang dipilih hanya apabila tugas berkaitan.

## Skills tersedia
| ID | Tujuan |
|---|---|
| code-debug | Diagnosis kod/ralat sebenar, patch kecil, ujian, rollback |
| web-research | Pisahkan snippet, teks halaman, HTML milik projek dan status belum disahkan |
| document-review | Jejak sama ada teks dokumen benar-benar tersedia |
| data-analysis | Semak lajur, unit, andaian dan pelaksanaan pengiraan |
| critical-review | Uji premis, bukti dan hujah tanpa membantah secara automatik |
| creative-writing | Ikut struktur puisi/prosa dan pisahkan petikan daripada tafsiran |

## Pelaksanaan
- Katalog enam prosedur ialah kod statik yang telah dikurasi dalam `netlify/functions/aksara-skills-v1.js`.
- `plan()` memilih maksimum **dua** skills mengikut intent dan cognitive profile, bukan sejarah atau kandungan pihak ketiga.
- `guidance()` menambah arahan hanya bagi skills terpilih. Metadata status research digunakan untuk **tidak** mengaku membaca sesuatu yang belum dibaca.
- Tidak memintas peraturan, tidak memanggil tool, tidak membaca fail rawak dan tidak memasang skrip luar.
- Tidak mengubah Voice Chat, UI, tools, pemilihan model, kuota atau routing 3+1.
- Reaksi ringkas, matematik ringkas, sokongan sensitif dan permintaan dengan status `sensitive` tidak melalui lapisan ini.

## Kawalan
Aktif secara lalai selepas merge. Rollback tanpa revert kod: tetapkan `AKSARA_SKILLS_ENABLED=false` pada persekitaran server. Tiada pembolehubah API baharu.

Ujian: `npm run test:aksara-skills` dan `npm run test:aksara-platform` melalui GitHub Actions. CI menguji pemilihan, batas bukti, tiada kebocoran input kepada system prompt, dan sambungan backend. Mutu model sebenar **belum terbukti meningkat** sehingga ujian A/B live dengan penilaian manusia.

## Hubungan dengan Agent Skills
Standard terbuka Agent Skills biasanya menggunakan folder `SKILL.md` ber-YAML dan boleh memuatkan resources/scripts bila diperlukan. Versi ini **bukan loader SKILL.md universal**. Ia memilih prosedur kod JS yang dibundel untuk memastikan keserasian Netlify dan mengelakkan pemasangan scripts pihak ketiga tanpa audit. Jika mahu sokongan SKILL.md selepas ini, bina parser allowlist, semak fail dan kebenaran, serta bundling assets dahulu.

Rujukan:
- https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- https://developers.cloudflare.com/agents/concepts/agent-skills/
