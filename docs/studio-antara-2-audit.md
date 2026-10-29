# Studio Antara 2.0 — rekod audit 29 Oktober 2026

## Skop

Branch pembangunan `codex/studio-antara-2`, asas `ecfd01c5c33d9334698ff959b74913c81e155a3f`.

Hanya Studio, fungsi imej/prompt khusus, helper quota/HTTP, dokumentasi, dependency backend dan ujian berkaitan diubah. Kod Bilik Antara, multi-AI, Voice Live, avatar, novel dan karya tidak diubah. Video tiada API atau UI aktif baharu.

## Ujian setempat

- 20/20 ujian Studio + IndexedDB lulus: kontrak preset, dimensi natif lima nisbah, langkah/resolusi, seed, validation, 401/403/429/500, timeout, saiz hasil, ledger CAS serentak, quota fail-closed, per-IP dan perkemas AI/fallback, simpan/baca/padam/kosongkan, eviction 24 / 30 MiB.
- 110/110 ujian utama Studio, reka bentuk Bilik Antara, Voice, identiti, kualiti dan metadata laman lulus.
- Suite semua `scripts/test-*.cjs tests/*.js`: 212 lulus, satu harness browser gagal mula kerana executable Chromium yang dijangka tiada. Ini batasan persekitaran, bukan assertion fungsi yang gagal. Tidak memasang browser baharu untuk memintas had.
- Syntax JS/CSS dan `git diff --check` lulus.
- Browser cloud: desktop dan iframe viewport 390px diperiksa. API mock dilabel jelas pada preview setempat dan tidak dimasukkan ke repo/produksi.
- Aliran browser mock berjaya: jana, nisbah auto memilih Klein, variasi dengan seed lain, buka hasil lama, jana semula, draf perkemas dan batal, ralat 429 sambil mengekalkan prompt/hasil, padam satu, kosongkan galeri, simpan selepas reload, pembatalan permintaan perlahan.
- Desktop mencetuskan download Blob sebenar. Clipboard automatik disekat oleh browser ujian; fallback textarea dipilih dan prompt asal kekal.
- Lighthouse CLI setempat tiada. Workflow Studio khusus ditambah untuk ujian Chromium 1440/390/320px dan Lighthouse desktop/mobile dalam GitHub Actions; hasilnya perlu dibaca daripada run sebenar. Tiada dakwaan ujian Safari iOS fizikal.

## Prestasi yang diukur

Fail frontend Studio sahaja (HTML + CSS + JS; tidak termasuk fon Google):

| Ukuran | Sebelum | Selepas |
|---|---:|---:|
| Saiz asal | 28,740 B | 42,526 B |
| Gzip setiap fail | 10,109 B | 15,319 B |

Pertambahan kira-kira 5.2 KB gzip membiayai galeri, kontrak model, preset, kawalan dan prompt enhancer. Tiada library browser/model baharu. Frontend tidak menjana imej pada peranti. Tiada permintaan inference automatik pada page load.

Ujian live asas sebelum perubahan: FLUX.1 Schnell menjana hasil sebenar HTTP 200; masa keseluruhan dari executor 10,191 ms, output base64 723,156 aksara. Ini satu sampel termasuk rangkaian/proxy; bukan perbandingan benchmark dengan laporan telefon pengguna ~3 saat.

## Deployment dan Cloudflare live

PR #65, #66 dan #67 telah digabungkan ke main. Dua isu deployment sebenar ditemui dan dibaiki: format Lambda lama tidak menyediakan endpoint Blobs uncached (503 fail-closed), kemudian dependency SDK tidak dipakejkan dari nested CommonJS (502). Format moden ESM, dependency injection dan external_node_modules khusus Studio menyelesaikannya. Tiada limiter keselamatan dilonggarkan untuk memintas kegagalan ini.

Selepas PR #67, lapan permintaan imej sebenar melalui laman produksi berjaya HTTP 200. Prompt sampel rumah api, preset Antara:

| Model / nisbah / kualiti | Dimensi sebenar | Seed | Cloudflare | Keseluruhan executor |
|---|---|---:|---:|---:|
| Schnell / 1:1 / Seimbang | 1024×1024 | tidak disokong | 1,457 ms | 9,786 ms |
| Klein / 9:16 / Seimbang | 432×768 | 42 | 7,424 ms | 15,199 ms |
| Klein / 1:1 / Pantas | 512×512 | 42 | 8,101 ms | 15,944 ms |
| Klein / 4:5 / Pantas | 512×640 | 42 | 6,390 ms | 14,069 ms |
| Klein / 16:9 / Pantas | 512×288 | 42 | 10,448 ms | 18,138 ms |
| Klein / 3:2 / Pantas | 576×384 | 42 | 6,563 ms | 14,176 ms |
| Klein / 9:16 / ulang | 432×768 | 42 | 7,532 ms | 13,608 ms |
| Klein / 9:16 / variasi | 432×768 | 43 | 6,613 ms | 14,347 ms |

Semua dimensi dibaca daripada header JPEG sebenar, tanpa crop. Seed 43 menghasilkan fail berlainan. Ulangan seed 42 turut mempunyai hash berlainan daripada hasil pertama: seed dikekalkan tetapi tiada janji reproducibility piksel tepat. Ini bukan image-to-image. Tidak semua gabungan 3 kualiti × 5 nisbah dibelanjakan pada ujian live; kontrak dimensinya diuji secara unit.

Perkemas prompt sebenar melalui Groq berjaya HTTP 200, method=ai, masa keseluruhan executor 8,582 ms. Input Melayu seorang wanita dalam cahaya keemasan diperkemas kepada komposisi visual Inggeris sambil mengekalkan subjek tunggal.

Sampel Schnell sebelum 10,191 ms berbanding selepas 9,786 ms bukan benchmark terkawal. Jangan mendakwa keseluruhan sistem sentiasa lebih pantas: Klein lebih fleksibel tetapi lebih perlahan. UI memaparkan masa tunggu client sebenar; masa inference upstream disimpan berasingan. Tiada key atau respons provider mentah dimasukkan dalam laporan.
