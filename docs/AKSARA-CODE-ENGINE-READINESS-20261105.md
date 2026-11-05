# AKSARA Code Engine · Runtime & Live Preview (5 November 2026)

## Prinsip
- HTML/CSS ialah **pratonton visual**, bukan compiler. AI HTML boleh dipaparkan terus dalam bubble chat melalui iframe sandbox tanpa skrip, borang, storan atau rangkaian. Butang Code Engine membuka sumber boleh sunting dalam Code Workspace.
- JavaScript dilaksanakan dalam Web Worker di dalam iframe sandbox. Python menggunakan Pyodide WASM, TypeScript menggunakan compiler TypeScript untuk semak/transpile sebelum pelaksanaan JS, SQL menggunakan SQLite WASM dan C++20 menggunakan Clang WASM/WASI.
- Lima runtime tetap **on-demand**: Python, TypeScript, SQL dan C++ memuatkan aset CDN apabila Run ditekan. Kod runtime tersedia dalam aplikasi, tetapi pakej compiler/binary **belum dibundel secara offline** dalam repositori; jangan dakwa semua compiler telah tertanam atau offline-ready.
- Java dikenali sebagai sumber sahaja. JVM/Java compiler belum disediakan; **jangan** jalankan Java dalam sandbox JavaScript atau mendakwa ia disokong.
- Proses pelaksanaan hanya dengan tindakan pengguna, kecuali laluan A.I. Code Execution sedia ada yang memerlukan izin pada tab. HTML/CSS boleh terus dipratonton kerana JS dinyahaktifkan.
- Had sumber 12,000 aksara setiap fail, sandbox yang boleh dihentikan dan output terhad dikekalkan.

## Kes yang dibaiki
- Satu blok \`\`\`html\`\`\`, HTML/CSS berasingan, HTML mentah lengkap dan dua contoh HTML dengan tajuk H1 sama yang dijelaskan sebagai “Pratonton” -> Live Preview.
- Dua dokumen berbeza -> tidak dipilih secara automatik.
- JavaScript, Python, TypeScript, SQL -> boleh tekan **Jalankan Kod** terus dari Code Workspace, dengan console/diagnostik dan Henti. C++ kekal pada panel Clang khas.
- Chat history lama tidak mencipta banyak iframe: hanya jawapan AI paling baru dipaparkan secara automatik ketika sejarah dipulihkan.

## Ujian perlu
- Node: \`node --test tests/aksara-code-preview.test.cjs tests/aksara-identity-lock.test.cjs\`
- Browser mudah alih: \`scripts/test-code-engine-browser.cjs\`, periksa HTML inline preview/animasi dan empat butang Run.
- Akses CDN sebenar: Python/TypeScript/SQL/C++ **belum disahkan** berjaya di Brave Android selagi smoke test setiap bahasa tidak dijalankan. C++ mungkin memuatkan ~29 MB.
- Kualiti dan sekatan: javascript \`console.log(42)\`, Python \`print(42)\`, TypeScript \`const n: number=42; console.log(n)\`, SQL \`SELECT 42 AS n;\`, C++20 \`std::cout << 42;\`, HTML animasi CSS. Java memaparkan notis tidak disokong.

## Pengesahan runtime
Butang **Uji 5 Runtime** dalam dialog Code Engine meminta persetujuan sebelum memuatkan aset CDN, kemudian menjalankan contoh sebenar bagi setiap bahasa dalam sandbox. Tekan lagi untuk Henti. Status Verified tamat selepas lima minit. Tiada unduhan automatik semasa halaman dibuka, dan ini bukan bukti offline-ready.
