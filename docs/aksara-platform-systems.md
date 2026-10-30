# Aksara Core Platform · Fasa asas

Dokumen ini menerangkan keupayaan yang benar-benar dilaksanakan dalam PR #98.
Semua modul menggunakan Node.js sedia ada; tiada pakej berbayar baharu.

## Komponen

| Komponen | Lokasi | Pelaksanaan |
|---|---|---|
| Security Shield | `netlify/functions/aksara-security-shield.js` | Pengasingan teks tidak dipercayai, isyarat prompt injection, suis pelayan |
| Knowledge Engine | `netlify/functions/aksara-knowledge-engine.js` | Carian konsep + kemiripan teks terhadap indeks karya dan nota yang dihantar atas pilihan |
| Context Manager 2.0 | `netlify/functions/aksara-context-manager.js` | Pilih giliran terbaru + konteks lama relevan + pembetulan pengguna |
| Intelligence Router 2.0 | `netlify/functions/aksara-model-registry.js` | Ranking kemampuan model serta sejarah kejayaan/latensi dalam proses |
| Safe Tool Execution | `netlify/functions/aksara-safe-tools.js` | Pengiraan matematik terhad tanpa eval/Function/shell |
| Structured Tool Calling | Modul sama | Skema dan allowlist nama/argumen; bukan pelaksanaan arahan bebas oleh model |
| Research Workflow | `netlify/functions/aksara-research-workflow.js` | Rujukan Wikipedia yang disahkan domain dan diberi label bukan berita langsung |
| Evaluation Lab | `scripts/aksara-evaluation-lab.cjs` | Penilaian deterministik luar talian; bukan penanda aras jawapan live |
| Control Center | `scripts/aksara-control-center.cjs` | Laporan developer setempat dan suis env, bukan portal admin awam |

## Arahan developer

```sh
npm run test:aksara-platform
npm run eval:aksara
npm run control:aksara
```

## Suis persekitaran

Setiap nilai hanya dimatikan jika nilainya secara tepat `true`:

- `AKSARA_DISABLE_AI`: hentikan permintaan AI pada laluan chat.
- `AKSARA_DISABLE_RESEARCH`: hentikan carian rujukan Wikimedia.
- `AKSARA_DISABLE_KNOWLEDGE`: hentikan retrieval Knowledge Engine.
- `AKSARA_DISABLE_TOOLS`: hentikan pengiraan setempat dan alat Gemini.
- `AKSARA_DISABLE_REVIEW`: hentikan semakan jawapan tambahan.

**Keselamatan:** Kawalan ini mesti ditetapkan pada pelayan Netlify, bukan dihantar oleh pengguna dalam mesej. Jangan masukkan nilai rahsia dalam fail frontend atau dashboard awam.

## Batas penting

1. **RAG semantik ringan, bukan vector RAG penuh.** Tiada model embedding, vector DB atau storan memori pengguna di pelayan. Nota peribadi hanya dipilih daripada konteks yang pengguna sudah hantar pada permintaan tersebut.
2. **Rate limiter global belum selesai.** Had IP memori fungsi asal tidak dikongsi merentas semua instance. Netlify edge/platform limiting dan ujian deploy diperlukan sebagai lapisan seterusnya.
3. **Security Shield bukan jaminan melawan semua prompt injection.** Alat berprivileg tidak pernah dijalankan dari teks sumber dan semua operasi perlu disahkan pada gerbang kod.
4. **Model Registry tidak mengukur IQ.** Skor keupayaan, kejayaan dan latensi bersifat heuristik serta terhad pada instance aktif.
5. **Research Workflow bukan live web search umum.** Hanya sumber yang benar-benar diperoleh melalui adapter Wikipedia dan URL yang disahkan boleh dirujuk; ia bukan sumber berita semasa.
6. **Safe Tool Execution tidak menawarkan arbitrary-code sandbox.** Pengiraan ringkas sahaja; Gemini code execution asal kekal berasingan dan boleh dimatikan.
7. **Evaluation Lab bukan benchmark LLM sebenar.** Perlu tambah set gold-standard yang dinilai manusia dan perbandingan jawapan live sebelum dakwa peningkatan kecerdasan secara kuantitatif.
8. **Control Center bukan dashboard produksi.** Tiada log perbualan atau token API didedahkan. Monitoring pusat dan autentikasi admin memerlukan fasa khusus.

## Antaramuka

Dalam `Ciri & Fungsi`, hanya **Pengetahuan & Rujukan** dipaparkan kepada pengunjung, sebagai pintu untuk mencuba pertanyaan. Suis admin dan metrik server-side tidak boleh dipaparkan secara awam.
