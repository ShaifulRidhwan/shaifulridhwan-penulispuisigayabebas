# Bilik Antara: OSINT TikTok akaun awam

## Fungsi

Pengguna boleh menaip secara biasa, contohnya:

> Semak akaun TikTok @puisigayabebas dan ringkaskan maklumat akaun yang boleh disahkan.

Bilik Antara mengesan username TikTok tanpa memerlukan mod khas. Ia memaparkan pautan profil yang dijana daripada username serta, **jika disahkan melalui API rasmi**, medan ini:

- Nama paparan dan bio awam (maklumat hubungan peribadi dikecualikan)
- Akaun disahkan (lencana), pengikut, mengikuti, jumlah suka, bilangan video
- Pautan laman dalam bio jika tersedia
- Masa data dikumpulkan dan asal sumber

Jika sambungan API rasmi tidak tersedia, kad menerangkan **profil belum disahkan**, kemudian AI boleh menggunakan Google Search Grounding untuk menyemak maklumat awam dengan rujukan. Data daripada carian tidak dilabel sebagai pengesahan TikTok.

Tiada percubaan mencari/meneka GPS, latitud, longitud, alamat rumah, lokasi masa nyata, IP, pemilik identiti tersembunyi, nombor telefon, e-mel peribadi atau maklumat belakang tabir. Negara hanya boleh disebut jika pemilik sendiri menyatakannya secara awam dan ia bukan bukti lokasi semasa.

## Sambungan API rasmi (pilihan)

Endpoint yang digunakan:

- TikTok Research API: `POST https://open.tiktokapis.com/v2/research/user/info/`
- TikTok Client Access Token: `POST https://open.tiktokapis.com/v2/oauth/token/`

Akses **Research API memerlukan kelulusan penyelidik yang layak** dan skop `research.data.basic`. Akaun developer biasa tidak menjamin akses. Rujukan: https://developers.tiktok.com/docs/en/research-api-specs-query-user-info dan https://developers.tiktok.com/docs/en/research-api-get-started

Jika projek mempunyai akses Research API yang benar-benar diluluskan, tetapkan di Netlify Environment Variables:

```text
TIKTOK_RESEARCH_CLIENT_KEY=<your approved client key>
TIKTOK_RESEARCH_CLIENT_SECRET=<your approved client secret>
```

Backend mendapatkan token melalui `client_credentials`, menyimpannya sementara di memori dan membuat panggilan terus kepada API rasmi. Jangan meletakkan kunci atau token dalam HTML, kod awam atau log.

Alternatif jika token sementara sudah tersedia:

```text
TIKTOK_RESEARCH_TOKEN=<valid approved research access token>
```

Token Research API lazimnya tamat selepas dua jam; kaedah client credentials lebih sesuai jika diluluskan.

`ENABLE_TIKTOK_PUBLIC_RESEARCH=false` boleh mematikan fungsi penyelidikan akaun rasmi. Carian Google dikawal oleh `ENABLE_SEARCH_GROUNDING` sedia ada.

**Tanpa kelulusan Research API:** tiada jalan pintas untuk mendapatkan statistik rasmi akaun orang lain secara pukal. Backend terus berfungsi melalui carian awam yang mempunyai keterbatasan dan mungkin tiada jawapan.

Untuk profil milik pengguna yang memberikan keizinan, TikTok Display API dan Login Kit boleh dibina secara berasingan dengan persetujuan pemilik akaun dan skop yang diluluskan. Jangan mengakses profil peribadi melalui kuki orang lain atau cuba mengatasi sekatan.

## Mengapa tidak salin scraper rawak dari GitHub?

Projek pihak ketiga seperti `yt-dlp` dan `tt-dlp` bergantung pada halaman/endpoint tidak terdokumen, boleh rosak sewaktu TikTok berubah, dan biasanya dioptimumkan untuk muat turun media, bukan semakan akaun yang boleh diaudit. Kod OSINT sengaja menggunakan API rasmi serta sumber beratribusi, bukan muat turun profil secara senyap.

## Pengujian

```bash
node --test scripts/test-bilik-antara.cjs scripts/test-tiktok-public-research.cjs
```

Ujian mocked tidak membuktikan API sebenar boleh dicapai, bahawa sesuatu akaun wujud, atau bahawa Netlify sudah dideploy. Untuk pengesahan produksi, gunakan akaun ujian awam dengan keizinan yang sesuai dan semak log Netlify tanpa mendedahkan rahsia.
