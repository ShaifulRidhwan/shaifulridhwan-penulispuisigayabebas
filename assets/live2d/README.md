# AKSARA Voice Live2D · Experimental v0.3

## Keputusan dan had semasa

Seni wanita dark-fantasy (emas kiri, biru kanan, mata amber, gaun bercorak matahari/bulan) **dikunci** sebagai rujukan. Fail `bilik-antara-avatar-2d-art.webp` ialah **rujukan rupa sahaja**, BUKAN fail Live2D.

**Eksperimen v0.3 ialah integrasi bersyarat, bukan model lengkap.** Selagi model `.moc3`, `.model3.json`, tekstur, dan Cubism runtime belum dipasang secara sah, paparan akan menyatakan rig belum tersedia. Tiada fallback yang melukis garis pada gambar. UI utama dan Gemini Live/Aoede kekal.

## Pilihan teknologi

1. **Sasaran utama:** Cubism SDK for Web rasmi, dipakej sendiri bersama pemapar berdasarkan Web Samples/Framework. [SDK](https://www.live2d.com/en/sdk/download/web/), [Web Samples](https://github.com/Live2D/CubismWebSamples).
2. **Proof-of-concept alternatif:** PixiJS 6 + `pixi-live2d-display/cubism4` + Cubism Core yang diperoleh secara sah. Kod `bilik-antara-live2d-v03.js` menyediakan laluan awal untuk pendekatan ini. Ini **bukan** bukti sokongan penuh semua ciri editor Cubism 5.3.
3. Cubism Core tidak dibundel secara automatik. Ia bukan komponen sumber terbuka daripada repositori GitHub rasmi; dapatkan dan patuhi lesen melalui Live2D.

**Lesen untuk Aksara A.I.** Live2D menyenaraikan kategori AI/chatbot dan konsep Expandable Application; jangan terbitkan pemapar atau model kepada khalayak tanpa menyemak kategori dan mendapatkan kelulusan/lesen jika diperlukan. [SDK Release License](https://www.live2d.com/en/sdk/license/) dan [Expandable Application](https://www.live2d.com/en/sdk/license/expandable/).

## Senarai lapisan PSD yang mesti ada

Sediakan **PSD RGB 8-bit**, setiap lapisan mengandungi bahagian yang telah dicantum (line art + warna), dengan piksel tersembunyi dilukis semula supaya apabila kepala berpusing tidak timbul lubang. Satu imej WebP siap tidak boleh secara automatik menjadi rig tulen.

| Kumpulan | Lapisan minimum |
| --- | --- |
| `00_reference` | artwork asal untuk panduan sahaja (jangan export sebagai ArtMesh bergerak) |
| `01_hair_back` | hair_back_main, hair_back_left, hair_back_right, inner_strands |
| `02_body` | shoulders, neck, gown_base, gown_light, gown_dark, collar, chest_emblem |
| `03_face` | face_base, ears, nose, cheek_shadow, jaw_shadow, face_highlight |
| `04_eye_left` | sclera, iris, pupil, upper_lid, lower_lid, lashes, eyebrow |
| `05_eye_right` | sclera, iris, pupil, upper_lid, lower_lid, lashes, eyebrow |
| `06_mouth` | mouth_closed, mouth_inside, upper_lip, lower_lip, teeth (optional) |
| `07_hair_front` | bangs_left, bangs_center, bangs_right, front_strands |
| `08_celestial` | sun_ornament, moon_ornament, left_earring, right_earring, hair_jewels |
| `09_effects` | light_gold, rim_blue (optional; better use CSS glow for perf) |

Semak latar telinga, kulit bawah rambut, mulut tertutup/terbuka, dan kawasan tersembunyi. Sasaran `PSD -> Cubism Editor -> ArtMeshes/Deformers/Physics -> Export for Runtime`.

Rujukan rasmi: [PSD Import](https://docs.live2d.com/en/cubism-editor-manual/psd-import/), [Illustration Processing](https://docs.live2d.com/en/cubism-editor-tutorials/psd/).

## Parameter wajib

`ParamAngleX/Y/Z`, `ParamEyeLOpen`, `ParamEyeROpen`, `ParamEyeBallX/Y`, `ParamBrowLY/RY`, `ParamMouthOpenY`, `ParamMouthForm`, `ParamBodyAngleX`, `ParamBreath`.

Physics/deformer tambahan: rambut depan, rambut belakang, anting-anting bulan dan matahari, kain serta loket. Ekspresi: neutral, smile, laugh, thinking, serious, surprised.

## Pemasangan selepas artwork betul-betul dirig

1. Guna Cubism Editor pada Windows/macOS, eksport runtime model dan tekstur. Rujukan fail: `assets/live2d/aksara/aksara.model3.json`, `assets/live2d/aksara/aksara.moc3`, `assets/live2d/aksara/textures/...`; fail motion/physics/expression ikut rujukan manifest.
2. Untuk PoC Pixi 6, sediakan runtime `assets/live2d/vendor/live2dcubismcore.min.js`, `assets/live2d/vendor/pixi.min.js`, dan `assets/live2d/vendor/cubism4.min.js`. Semak versi dan terma setiap komponen, jangan muat naik tanpa hak penggunaan.
3. Buka `/bilik-antara.html?voice-avatar=live2d&voice-preview=1&voice-avatar-demo=1`; tanpa model/SDK, paparan **mesti** menunjukkan status "Rig Live2D belum dipasang", bukan wajah palsu.
4. Selepas model dan runtime sudah sah, uji `?voice-avatar=live2d` dengan Voice Chat sebenar (memerlukan sambungan Gemini di host yang betul). Jaga 30 FPS sasaran telefon, had resolusi render dan jimat kuasa apabila tab disembunyikan.
5. Kekalkan `?voice-avatar=2d` sebagai sejarah eksperimen v0.2 sahaja; **jangan gunakan** wajah Canvas itu sebagai keputusan akhir.

## P0-P4 kriteria penerimaan

- **P0:** Model .moc3 sebenar berjaya load, bukan SVG/WebP tunggal, tiada garis palsu.
- **P1:** Kepala, mata, rambut dan pakaian mempunyai gerakan yang dihasilkan daripada parameter/physics Cubism.
- **P2:** `ParamMouthOpenY` bergerak dengan amplitud audio playback Aoede sebenar dan kembali 0 apabila diam/mute/tamat.
- **P3:** Respons AI mengawal ekspresi secara lembut, tidak menganggap kata "sedih" secara automatik sebagai emosi pengguna.
- **P4:** Ujian Android/desktop, modal, reduce-motion, minimize, reconnect, 30 FPS dan tiada kemerosotan Gemini Live/voice.

## Work atau chat biasa?

Kod GitHub, dokumentasi dan CI boleh dibuat dari chat ini. Untuk kerja visual intensif (melukis layer yang tersembunyi, brush mask, memperbaiki ekspresi, deformer mesh dan physics dalam Cubism Editor), **Work** boleh lebih sesuai jika ada akses kepada aplikasi grafik dalam komputer/sesi yang digunakan. Ia tetap tidak menghasilkan .moc3 daripada satu imej secara automatik.