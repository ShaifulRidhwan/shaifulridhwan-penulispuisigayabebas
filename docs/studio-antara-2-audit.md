# Studio Antara 2.0 — rekod audit 29 Oktober 2026

## Skop

Branch pembangunan `codex/studio-antara-2`, asas `ecfd01c5c33d9334698ff959b74913c81e155a3f`.

Hanya Studio, fungsi imej/prompt khusus, helper quota/HTTP, dokumentasi, dependency backend dan ujian berkaitan diubah. Kod Bilik Antara, multi-AI, Voice Live, avatar, novel dan karya tidak diubah. Video tiada API atau UI aktif baharu.

## Ujian setempat

- 19/19 ujian Studio + IndexedDB lulus: kontrak preset, dimensi natif lima nisbah, langkah/resolusi, seed, validation, 401/403/429/500, timeout, saiz hasil, ledger CAS serentak, quota fail-closed, per-IP dan perkemas AI/fallback, simpan/baca/padam/kosongkan, eviction 24 / 30 MiB.
- 109/109 ujian utama Studio, reka bentuk Bilik Antara, Voice, identiti, kualiti dan metadata laman lulus.
- Suite semua `scripts/test-*.cjs tests/*.js`: 212 lulus, satu harness browser gagal mula kerana executable Chromium yang dijangka tiada. Ini batasan persekitaran, bukan assertion fungsi yang gagal. Tidak memasang browser baharu untuk memintas had.
- Syntax JS/CSS dan `git diff --check` lulus.
- Browser cloud: desktop dan iframe viewport 390px diperiksa. API mock dilabel jelas pada preview setempat dan tidak dimasukkan ke repo/produksi.
- Aliran browser mock berjaya: jana, nisbah auto memilih Klein, variasi dengan seed lain, buka hasil lama, jana semula, draf perkemas dan batal, ralat 429 sambil mengekalkan prompt/hasil, padam satu, kosongkan galeri, simpan selepas reload, pembatalan permintaan perlahan.
- Desktop mencetuskan download Blob sebenar. Clipboard automatik disekat oleh browser ujian; fallback textarea dipilih dan prompt asal kekal.
- Lighthouse CLI tiada. Tiada dakwaan skor Lighthouse atau ujian pada peranti iOS fizikal. Paparan 390px bukan bukti safari iOS sebenar.

## Prestasi yang diukur

Fail frontend Studio sahaja (HTML + CSS + JS; tidak termasuk fon Google):

| Ukuran | Sebelum | Selepas |
|---|---:|---:|
| Saiz asal | 28,740 B | 42,492 B |
| Gzip setiap fail | 10,109 B | 15,302 B |

Pertambahan kira-kira 5.2 KB gzip membiayai galeri, kontrak model, preset, kawalan dan prompt enhancer. Tiada library browser/model baharu. Frontend tidak menjana imej pada peranti. Tiada permintaan inference automatik pada page load.

Ujian live asas sebelum perubahan: FLUX.1 Schnell menjana hasil sebenar HTTP 200; masa keseluruhan dari executor 10,191 ms, output base64 723,156 aksara. Ini satu sampel termasuk rangkaian/proxy; bukan perbandingan benchmark dengan laporan telefon pengguna ~3 saat.

## Deployment dan Cloudflare live

Belum direkodkan sebelum merge. Bahagian ini akan dikemas kini selepas percubaan deployment dan smoke test sebenar. Jangan anggap ujian mock sebagai pengesahan Cloudflare.
