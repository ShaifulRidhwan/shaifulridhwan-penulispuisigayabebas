# Sejarah Pembangunan AKSARA

Arkib ringkas detik pembangunan, keputusan reka bentuk dan pengajaran yang wajar diingati. Ini ialah catatan projek, bukan salinan penuh perbualan peribadi atau log pengguna.

## 1 November 2026 | Insiden Garis Kuning 1px

**Nama tidak rasmi:** *Garis kuning yang mengalahkan dua pemerhati.* 🤣

### Apa yang berlaku?

Ketika pembangunan AKSARA A.I. sedang rancak dengan Cognitive Engine 3.0, UI glass, Voice Live **Aoede** dan migrasi Cloudflare, dua pemerhati, pembangun dan pembantu AI, sama-sama terlepas satu perkara yang kelihatan remeh: **garis emas nipis di bawah header**.

Garis itu tidak memecahkan susun atur, tidak mencetuskan ralat, dan tidak mengganggu mana-mana fungsi. Ia malah nampak seolah-olah sebahagian daripada identiti warna cahaya keemasan AKSARA.

Hanya selepas membandingkan **header Studio**, yang melengkung seperti kaca terapung, dengan **Bilik Antara** dan **Novel**, barulah ketidakselarasan tersebut kelihatan. Keputusan akhir: **samakan lengkungan glass ketiga-tiga header dan buang garis kuning; jangan usik UI lain.**

### Bukti dalam kod

- **Asal:** [Commit `e1c2bfcd`](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/commit/e1c2bfcd12d88ee8b3e9b93ee8fa70c30498d7b5), 31 Oktober 2026 (waktu Malaysia), memperkenalkan `aksara-header.css` sebagai header bersama.
- Tiga gaya menyumbang kepada rupa garis: **`border-bottom` emas**, pseudo-elemen **`::after` ber-gradient emas**, dan **`box-shadow` inset di bahagian bawah**.
- **Penyelesaian:** [PR #133](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/pull/133), *style(header): unify curved Studio glass across Bilik Antara and Novel*.
- **Merge:** [Commit `38b0680f`](https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/commit/38b0680ffe60b5fe04081de3fc8de1ceb97a1aa6), 1 November 2026.
- **Pengesahan:** 11/11 pemeriksaan pada PR lulus sebelum merge; **9/9 pemeriksaan selepas merge lulus**, termasuk Cloudflare Workers Builds serta audit browser.

### Kenapa boleh terlepas?

1. CSS itu sah dan berfungsi. CI tidak menganggap hiasan yang tidak lagi perlu sebagai kegagalan.
2. Ujian automatik memeriksa perkara yang ditakrifkan: fungsi, responsif, prestasi, dan peraturan yang diketahui, bukan semua pilihan estetika.
3. Warna garis itu serasi dengan tema AKSARA, jadi ia tidak kelihatan seperti ralat secara spontan.
4. Perbandingan visual antara halaman akhirnya mendedahkan perbezaannya.

### Pengajaran

**`Technical correctness` tidak semestinya `visual consistency`.**

Selepas perubahan yang besar, buat semakan visual merentas halaman untuk komponen yang dikongsi. Periksa juga elemen yang *tidak rosak* tetapi mungkin sudah tidak diperlukan.

> **AKSARA Intelligence 3.0: LULUS. Garis kuning 1px: sempat mengalahkan dua pemerhati.** 🤣

**Status:** Selesai. Catatan ini disimpan sebagai sejarah pembangunan, bukan arahan untuk mengubah semula header.
