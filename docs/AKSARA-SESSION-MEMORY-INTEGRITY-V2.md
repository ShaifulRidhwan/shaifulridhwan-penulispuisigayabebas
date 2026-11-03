# AKSARA Bilik Antara: Sesi & Memori Integrity v2

## Mengapa dibaiki

Audit pada commit \`f1ee1116354ef103080bf52a0cb490da87d36f44\` mendapati empat risiko pengguna:

1. **Arkib tab bersaing.** \`archive\` hanya dibaca pada halaman mula, lalu salinan lama boleh menulis semula keseluruhan arkib dan menindih perbualan tab lain.
2. **ID sesi selepas reload.** Logik tab aktif memilih ID baru apabila ID asal sudah wujud dalam arkib. Ini boleh menyebabkan sesi pendua dan pulih perbualan salah apabila tab lain menulis snapshot global.
3. **Draf memori tidak dilindungi.** Tutup panel/Escape atau beberapa render boleh menghilangkan nota yang belum ditekan **Simpan memori**.
4. **Pilihan OFF memadam sejarah serta-merta.** Pengguna boleh tersalah mematikan **Simpan sesi**, lalu \`localStorage\` dibersihkan tanpa dialog pengesahan atau peluang mengeksport terlebih dahulu.

## Pelaksanaan

- **Merge berasaskan perubahan.** Setiap operasi arkib kini membaca versi terkini daripada peranti; hanya ID yang ditambah/dikemas kini atau dibuang ditulis. Kegagalan membaca arkib menolak overwrite dan memberi notis.
- **Pulihkan perbualan tab asal.** ID aktif dalam \`sessionStorage\` mengutamakan arkib tab tersebut apabila snapshot lama dikongsi dengan tab lain. Legacy snapshot dan format arkib dikekalkan.
- **Memori draf selamat.** Perubahan nota dan suis dikesan; penutupan panel dan pertukaran sesi meminta pengesahan, dan peringatan tab keluar menggunakan \`beforeunload\`. Render semula mengekalkan draf. Simpan/Padam memori yang disahkan mengosongkan status draf dengan betul.
- **Konflik memori merentas tab.** Operasi \`storage\` mengemas kini memori tersimpan pada tab lain. Nota draf yang berdasarkan versi lama tidak boleh diam-diam menindih nota terkini. Pengguna perlu mengesahkan overwrite.
- **Opt-out jelas.** Mematikan \`Simpan sesi\` kini menerangkan bahawa arkib akan dipadam dan mengingatkan tentang eksport. Jika dibatalkan, checkbox kekal ON. Pilihan OFF dipatuhi di semua tab. Jika storan pelayar menolak pemadaman, sistem memberitahu secara jelas dan tidak menjanjikan data sudah dipadam.
- **Privasi tidak diubah.** Kedua-dua ciri default ON untuk tetapan baharu seperti diminta, tetapi OFF tersimpan kekal dihormati. Nota memori tetap disimpan secara manual, kosong sehingga ditulis pengguna, di \`localStorage\` peranti sahaja. Ia bukan ingatan cloud, tidak disulitkan, dan tidak dihantar kepada fallback teks tanpa izin asal.
- **Tiada perubahan** pada Gemini, Groq, OpenRouter, Workers, Voice Live, Studio, alat carian atau model thinking.

## Ujian

\`\`\`sh
npm run test:aksara-memory-integrity
npm run test:aksara-platform
\`\`\`

Ujian browser dua tab menggunakan Chromium pada localhost, tanpa panggilan API sebenar:

- Tab A dan B menyimpan sesi masing-masing; satu tidak menimpa yang lain.
- Reload tab A selepas B menyimpan memulihkan sesi A.
- Draf memori tab B tidak boleh menggantikan pembetulan tab A tanpa pengesahan.
- Escape dengan draf meminta pengesahan; Cancel mengekalkan editor.
- OFF yang dibatalkan tidak mengosongkan arkib. OFF yang disahkan menghentikan simpanan baharu merentas tab.
- Mematikan penyimpanan sejarah tidak memadam nota memori berasingan.

## Batas dan risiko baki

- Pelayar mengawal \`localStorage\`, \`sessionStorage\` dan kuota. Tiada jaminan jika pengguna memadam data pelayar, menggunakan mod privasi, atau storan penuh.
- **Read-merge-write dalam localStorage bukan transaksi atomik antara dua tab**. Event \`storage\` dan merge pada masa simpan mengurangkan risiko kehilangan data, tetapi penulisan serentak tepat pada milisaat yang sama masih boleh bertembung. Penyelesaian kukuh memerlukan IndexedDB dengan transaksi atau storan per-sesi, yang belum diperkenalkan kerana perlu migrasi berisiko.
- Tab yang sudah membuka sesi boleh mempunyai salinan sejarah dalam RAM walaupun tab lain memadam arkib. OFF menghentikan persist dan memadam sejarah simpanan; ia bukan remote logout.
- Nota tidak disulitkan dan bukan sistem memori akaun. Elakkan rahsia atau data kesihatan. Untuk sandaran, gunakan eksport JSON secara sengaja.
- CI browser menguji mock dan storan tempatan, bukan deploy produksi atau keadaan semua browser mudah alih.

## Rollback

Revert PR berkaitan jika perlu, jangan force-push \`main\`. Format penyimpanan dan nama key lama dikekalkan, jadi downgrade tidak memerlukan migrasi arkib.
