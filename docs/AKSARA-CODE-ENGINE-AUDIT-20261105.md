# AKSARA Code Engine · audit dan pembaikan 5 November 2026

## Punca yang telah dikesan

- Bilik Antara telah mempunyai Code Runtime, Code Workspace, dan HTML/CSS Live Preview, tetapi jawapan AI dengan dua blok HTML berlainan tidak dipratonton secara automatik. Laluan sebelum ini hanya memberi butang ke Workspace jika tepat satu HTML dijumpai.
- Code Workspace memaparkan editor dan HTML preview, serta konsol C++ khusus, tetapi JavaScript, Python, TypeScript dan SQLite memerlukan tindakan salin ke chat sebelum Run.
- Tidak semua compiler tersedia sepenuhnya secara tempatan. JavaScript menggunakan enjin browser. Python (Pyodide), TypeScript, SQLite-WASM dan Clang-WASM menggunakan CDN jsDelivr pada penggunaan pertama. Kod pengguna kekal dalam iframe opaque-origin/Worker yang boleh dihentikan, tetapi ketersediaan CDN dan prestasi peranti menentukan sama ada runtime berjaya.
- Java belum mempunyai runtime/compiler. Java tidak boleh dihantar ke JavaScript sandbox. Contoh yang menggunakan tkinter/turtle memerlukan UI desktop dan tidak boleh dianggap boleh dipratonton melalui Python browser.

## Perubahan

1. Blok HTML/CSS dalam jawapan AI kini menghasilkan **inline live preview automatik** dalam bubble, menggunakan `safePreviewDocument`, iframe `sandbox=""` dan CSP `script-src 'none'`, tanpa kod JS, borang, iframe lain atau rangkaian. Paparan ini ialah HTML/CSS sahaja, bukan pelaksanaan aplikasi JS.
2. Dokumen HTML pendua disatukan; jika terdapat sehingga tiga contoh HTML berlainan, pengguna boleh menukar antara preview 1/2/3 dengan sengaja. Arahan ringkas `jalankan kod` tetap tidak memilih mana-mana kod yang ambigu.
3. Code Workspace mempunyai butang Run, Stop dan konsol terus untuk **JavaScript, Python, TypeScript dan SQL**, disambung ke runtime sedia ada. C++ masih menggunakan panel Clang khusus bersama input `cin`. Output/diagnostik dipaparkan dalam dialog.
4. Menu Code Engine mempunyai pilihan **Uji Runtime** bagi setiap bahasa, menjalankan smoke test dalam sandbox atas tindakan pengguna. Status `Verified` hanya dicatat selepas ujian lulus. Tiada muat turun Clang ~29 MB secara automatik ketika memuat halaman.
5. Versi aset diperbaharui untuk mengurangkan kesan cache browser. Routing Multi A.I., Voice Live, Studio dan Novel tidak diubah.

## Had yang mesti dituturkan dengan tepat

Ini **bukan pemasangan compiler sepenuhnya ke dalam repositori atau pakej offline**. Menghos sendiri Pyodide, TypeScript, SQLite-WASM dan Clang-WASM memerlukan fail JS/WASM lengkap berserta dependensi, semakan lesen dan integriti, bajet saiz deploy serta ujian browser Android sebenar. Jangan iklankan `Offline ready` sebelum semua aset setempat disediakan dan diuji tanpa rangkaian.

Runtime sebenar boleh gagal apabila CDN disekat, tiada Internet, peranti kekurangan memori atau masa compile tamat. Java tiada compiler; C++ fokus output terminal, bukan grafik. Semua pelaksanaan tidak dipercayai sepatutnya terus menggunakan sandbox dan had masa/sumber.

## Ujian penerimaan

- Minta AI menjana HTML/CSS. Live Preview muncul terus di bawah bubble; butang `Buka dalam Code Workspace` masih berfungsi.
- Berikan **dua blok HTML berbeza**, seperti dua versi tajuk; panel memilih `Pratonton 1` dan `Pratonton 2`. Dua blok pendua ialah satu preview.
- Cuba `<script>parent.document.body...</script>`, `<iframe>` dan sumber luaran dalam HTML. Tidak boleh dijalankan/dimuatkan dalam preview. CSS inline boleh dianimasikan.
- Dalam Code Engine > Code Workspace, tambah fail `.js`, `.py`, `.ts`, `.sql`, `.cpp`. Untuk empat yang pertama, semak konsol Run/Stop; C++ menggunakan Run C++.
- Dalam Code Engine > Uji Runtime, pilih JavaScript kemudian Python, TypeScript, SQL dan C++ satu demi satu. Pastikan status Verified hanya setelah lulus. Untuk C++ sediakan data/Wi-Fi kerana ~29 MB boleh dimuatkan.
- Jalankan `node --test tests/aksara-code-preview.test.cjs` dan ujian Chromium sedia ada; kemudian lakukan semakan di Brave Android dan Netlify deploy sebenar.

## Semantik keselamatan

Auto-preview tidak boleh menjadi auto-run untuk JavaScript/TypeScript/Python/SQL/C++. Kod AI bukan arahan dipercayai. Pengguna masih perlu tekan Run bagi runtime yang mengeksekusi kod. Penyedia AI hanya menerima kod/output melalui aliran Code Bridge yang mendapat persetujuan khusus.
