# Studio Antara 2.0 — operasi dan batasan

Studio ini khusus untuk jana imej melalui Cloudflare Workers AI dan Netlify Functions. Video ditangguhkan. Tiada model besar, GPU runtime atau API token dihantar ke browser. Tiada perubahan pada Bilik Antara, Voice Live, avatar, novel atau laman utama.

## Model dan tetapan yang disokong

| Model | Kualiti | Nisbah | Seed |
|---|---|---|---|
| FLUX.1 Schnell | Pantas 2 langkah; Seimbang 4; Detail 8 | Output segi empat. Dimensi sebenar dibaca daripada imej hasil. | Tidak dihantar: dokumentasi skema hanya menyenaraikan prompt dan steps. |
| FLUX.2 Klein 4B | Pantas / Seimbang / Detail memilih resolusi. Langkah kekal 4; tidak menghantar `steps` atau `guidance`. | Dimensi natif di bawah; bukan crop. | Integer 0–2147483647; kosong menjana seed rawak pada backend. |

Cloudflare menerima Klein melalui multipart FormData, berbeza daripada JSON Schnell. Tiada input imej atau image-to-image dibangunkan. Variasi bermaksud prompt/preset/nisbah/kualiti sama, seed berbeza. Pada Schnell, gunakan jana semula untuk sampel baharu; butang variasi seed dinyahaktifkan dengan penerangan. Jana semula Klein mengekalkan seed sebenar hasil itu; seed yang sama tidak menjamin fail serupa tepat. Ujian live seed 42 menghasilkan hash imej berbeza walaupun tetapan sama; jangan menjanjikan reproducibility piksel tepat.

| Nisbah | Pantas | Seimbang | Detail |
|---|---|---|---|
| 1:1 | 512×512 | 768×768 | 1024×1024 |
| 4:5 | 512×640 | 768×960 | 896×1120 |
| 9:16 | 288×512 | 432×768 | 576×1024 |
| 16:9 | 512×288 | 768×432 | 1024×576 |
| 3:2 | 576×384 | 768×512 | 1152×768 |

Backend menolak hasil Klein jika dimensi sebenar berbeza daripada permintaan. Ia tidak memotong hasil untuk menyembunyikan kesalahan nisbah.

Dokumentasi primer diperiksa 29 Oktober 2026:
- [FLUX.1 Schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/)
- [Skema model dan kawalan khusus](https://developers.cloudflare.com/agents/models/ai-sdk/)
- [Pelancaran Klein 4B: multipart, dimensi dan seed](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/)
- [Harga dan peruntukan Neurons](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Netlify Blobs: strong consistency dan conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

## Environment variables dan bajet

Sedia ada: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Token hanya dibaca pada backend dan tidak pernah dipulangkan dalam respons. Tiada token baharu diperlukan untuk imej.

Pilihan:
- `STUDIO_DISABLED=true`: hentikan penjanaan dengan selamat.
- `STUDIO_DAILY_NEURONS`: bajet rizab harian Studio; lalai 6000, dihadkan maksimum 8000. `0` menghentikan penjanaan. Reset 00:00 UTC / 08:00 Malaysia.
- Perkemas AI menggunakan `GROQ_API_KEY` sedia ada hanya apabila `GROQ_FREE_CONFIRMED=true`. Tiada ubah suai pada router multi-AI. Jika tidak tersedia, mod ringan digunakan.

`@netlify/blobs` ialah satu-satunya kebergantungan runtime baharu, khusus backend, untuk kawalan bajet atomik. `fake-indexeddb` hanya dependency ujian. Frontend tiada library baharu.

Fungsi Studio menggunakan format moden Netlify (`studio-image.mjs` / `studio-enhance.mjs`) supaya SDK menerima endpoint uncached yang diperlukan untuk strong consistency. Format Lambda lama melalui `connectLambda` tidak membawa konfigurasi uncached tersebut. SDK diimport pada entrypoint ESM dan disenaraikan dalam `external_node_modules` untuk dua fungsi Studio sahaja supaya dependency dipakejkan oleh Netlify.

Ledger Blobs site-wide, strong consistency, conditional `onlyIfNew` / `onlyIfMatch`:
- Maksimum 2 permintaan serentak merentas instance; lease 70 saat, upstream imej dibatalkan selepas 45 saat.
- Maksimum 8 percubaan imej per 10 minit bagi hash IP harian. IP dipercayai diambil daripada `context.ip` runtime Netlify; browser tidak memilih identiti IP ledger.
- Setiap percubaan merizab Neurons anggaran konservatif sebelum inference. Gagal/henti tetap dikira; tiada refund yang boleh menggandakan bajet.
- Schnell merizab untuk 16 tile (lebih tinggi daripada output biasa) dan steps. Klein merizab mengikut tile dimensi diminta. Tambahan margin 15%. Ini anggaran berdasarkan harga semasa, bukan bacaan bil Cloudflare.
- Perkemas AI dihadkan satu per minit bagi hash IP, 50 sehari untuk seluruh Studio.
- Jika Blobs tiada/gagal, imej tidak dijana. Tiada fallback limiter Map yang dianggap global.

Ledger hanya menyimpan kiraan, hash IP bersalt harian dan lease; tidak menyimpan prompt atau imej. Penggunaan Blobs tertakluk pada kuota pelan Netlify sedia ada. Ia bukan servis pihak ketiga berbayar yang ditambah.

Kuota Workers AI percuma ialah 10,000 Neurons sehari untuk seluruh akaun, bukan setiap pengguna. Pelan Free menolak lebihan; pelan Paid boleh mengenakan caj. Bajet Studio tidak mengira servis lain yang menggunakan akaun Cloudflare. Kekalkan pelan Free untuk jaminan tiada lebihan bil Cloudflare; jangan menganggap ledger ini alat kawalan bil keseluruhan akaun. Jika harga model berubah, semak `StudioConfig.estimate` dan turunkan bajet. Origin checking bukan authentication; ledger mengurangkan penyalahgunaan tetapi bukan pengganti perlindungan bot untuk trafik besar.

## Prompt dan preset

Sepuluh preset (dan pilihan tanpa preset) ditambah pada prompt sebenar melalui kontrak bersama frontend/backend. Tiada butang kosmetik palsu. Prompt mentah maksimum 1200 aksara; komposisi kekal di bawah had Schnell 2048.

Perkemas hanya dihantar apabila pengguna menekan butang AI. Draf boleh diedit, digunakan, dibatalkan atau dipulangkan ke prompt asal. AI cuba mengekalkan subjek/maksud tetapi tidak boleh menjamin kesetiaan sempurna; pengguna mesti menyemak draf. Mod ringan menambah arahan visual umum dan bukan terjemahan semantik. Prompt melebihi 850 aksara dikekalkan tanpa pemotongan.

## Sejarah dan prestasi

IndexedDB `studio-antara-v2` mempunyai store metadata, imej penuh Blob dan thumbnail berasingan. Had 24 hasil / 30 MiB; eviction tertua dalam transaksi atomik. Tiada imej base64 dalam localStorage. Galeri dibuka atas tindakan pengguna, 6 thumbnail setiap halaman; imej penuh dibaca hanya ketika dibuka atau disimpan. Tiada muat naik imej sejarah ke awan. Ralat storan tidak menghalang preview dan muat turun hasil semasa. Browser boleh membersihkan storan, jadi pengguna perlu menyimpan imej penting sendiri.

Henti membatalkan fetch browser, tetapi tidak menjamin inference yang sudah dihantar berhenti atau kuota dipulangkan. Tiada auto retry imej. Blob URL dibersihkan dan bfcache dipelihara. Reduced motion mematikan animasi loading. Tiada API AI dipanggil pada page load.

## Audit pembersihan

Runtime imej setempat lama sudah dibuang oleh commit asas. Audit repo tidak menemui model/ONNX/runtime browser aktif. Rujukan nama cache lama dalam `removeOldImageRuntime` sengaja dikekalkan untuk membersihkan cache dan service worker khusus versi lama pada peranti pengguna. Jangan buang cache laman lain.

## Pengesahan

`npm ci --ignore-scripts` kemudian `npm run test:studio`.

Ujian mock/unit tidak membuktikan API sebenar. Lihat `studio-antara-2-audit.md` untuk bukti deployment, ujian live dan batasan pengujian.
