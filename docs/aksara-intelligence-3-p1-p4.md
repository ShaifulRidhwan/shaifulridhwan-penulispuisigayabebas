# AKSARA Intelligence 3.0 | Fasa 1-4

Status: **candidate dalam PR, belum bukti peningkatan kualiti jawapan live**.

## Skop

1. **Cognitive Engine 3.0** — pengesanan susulan eliptik (termasuk "yang kedua"), keperluan bukti eksplisit dan arahan membezakan sumber sah daripada inferens. Tiada model tambahan atau pendedahan proses penaakulan dalaman.
2. **Context Manager 3.0** — pilih mesej terbaru dahulu, ambil pembetulan lama yang relevan, kekalkan urutan asal dan kuatkuasakan had aksara walaupun mesej terbaru terlalu panjang. Tiada memori server atau pemindahan sejarah ke storan pihak ketiga.
3. **Adaptive Router 3.0** — kebolehpercayaan serta latensi provider dalam tempoh pemerhatian 30 minit, decay rekod lama, pengendalian kapasiti vision dan penjajaran mengikut tugasan. **Bukan skor IQ/kualiti model**. Polisi 3+1, cooldown, kuota dan keperluan user consent tidak diubah.
4. **Knowledge Engine 2.0** — skor tajuk karya tepat dan memilih potongan teks sumber yang relevan; provenance bagi karya awam dan nota sesi. Pengambilan nota peribadi hanya pada permintaan yang dibenarkan, dan konteks masih ditapis sebelum dihantar ke fallback.

## Pelaksanaan

- Modul utama: `netlify/functions/antara-intelligence.js`, `aksara-context-manager.js`, `aksara-model-registry.js`, `aksara-knowledge-engine.js`.
- Cloudflare Worker menggunakan handler teks bersama daripada direktori `netlify/functions`, jadi modul ini berfungsi pada laluan Worker tanpa menggandakan implementasi.
- Ujian deterministik: `node --test tests/aksara-intelligence-3.test.cjs`.
- Ujian integrasi: `npm run test:aksara-platform` dan workflow Bilik Antara, Cloudflare serta identity regression.
- Tidak mengubah HTML, CSS, animasi, Studio Antara, Voice Live, data karya, Cloudflare bindings, token atau sebarang secret.

## Had dan langkah sebelum merge

- Ujian mocked/deterministik membuktikan fungsi kod, **bukan** peningkatan mutu jawapan AI sebenar.
- Registry hanya menilai kejayaan permintaan HTTP / jawapan kosong dan latensi, bukan kebenaran output; metrik kekal dalam proses.
- Knowledge Engine kekal semantic-lite, tanpa embedding atau Vectorize yang diaktifkan.
- Lakukan staging smoke untuk CAHAYA/GELAP, 3 penyedia utama, OpenRouter sebagai sandaran terakhir, stream SSE, follow-up panjang, prompt injection dan konteks privasi. Jangan merge jika regresi berlaku.
- **Evaluation Lab 2.0 yang menilai jawapan live** diletakkan dalam fasa 5 berasingan, mengikut keputusan pemilik.

## Rollback

Revert PR/commit yang membawa modul ini. Tiada migrasi data atau binding baharu diperlukan.
