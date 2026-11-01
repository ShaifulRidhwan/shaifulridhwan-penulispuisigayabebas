# AKSARA / Cloudflare Opportunity Audit
**Tarikh:** 2026-11-01 · **Skop:** Bilik Antara, Aksara A.I., Studio Antara · **Status:** R&D pada PR #127; bukan production cutover.

## Disahkan sudah wujud
- Worker Static Assets untuk Bilik Antara, Studio dan Novel, tidak memindahkan laman utama.
- Workers AI native `env.AI` menjalankan GLM-4.7-Flash (131,072 context tokens, multilingual, reasoning/function calling menurut model card). Itu had model, bukan janji context dihantar atau memori kekal.
- Durable Object SQLite untuk rate-limit dan kuota; tiada mesej, transkrip atau alamat IP mentah disimpan.
- CI mock menguji identiti, mesej, CAHAYA/GELAP, konteks, stream.
- **Tambahan PR ini:** panggilan GLM sendiri dihadkan 24/hari secara global (boleh dilaras melalui `AKSARA_WORKERS_AI_DAILY_REQUESTS`) dan 4 panggilan/10 minit bagi klien, terpisah daripada kuota Chat dan Studio. Sifar mematikan akses GLM.
- **Tambahan PR ini:** `AKSARA_AI_GATEWAY_ID` opsyenal, sahaja jika pemilik konfigurasi gateway telah wujud. AI Gateway dipanggil dengan `skipCache:true` dan `collectLog:false`. Tiada caching jawapan sesi peribadi.

## Peluang dan keutamaan
| Tahap | Keupayaan | Faedah konkret | Kos, privasi dan trade-off | Keputusan |
|---|---|---|---|---|
| P0 | Dedicated Workers AI quota + AI Gateway privacy | Mengelak AI ketiga menghabiskan neurones Studio, perbandingan metrik tanpa prompt mentah | Global request cap hanya anggaran kos, bukan ukuran neurones tepat; perlu audit sebenar di Dashboard | **Dilaksana dalam PR** |
| P1 | AI Gateway analytics, rate limiting, spend limits | Jejak kesilapan 429, masa respons, kos dan perbezaan penyedia; kawal overages | Gateways mesti dikonfigurasi, provider BYOK/Unified Billing diperlukan bagi penyedia luar; disable per-request logs dan user data | **Penyepaduan opt-in disediakan, dashboard belum dihidupkan** |
| P1 | Turnstile tanpa gangguan | Cegah bot membakar kuota Chat/Studio; risiko pencurian token dikurangkan | Token mesti disemak di server, bukan cuma widget. Tambah hanya jika bot menjadi masalah, kerana UI sedia ada minimalis | **Cadangan** |
| P1 | Cloudflare AI Search (RAG karya diterbitkan) | Soal karya, konsep falsafah dan novel dengan petikan yang boleh disahkan | Indeks hanya karya awam; jangan indeks perbualan peribadi tanpa izin. Ada kuota query/ingestion dan kos; baca had 1,000 semantic + 1,000 full-text queries / bulan | **Cadangan eksperimen read-only** |
| P2 | Vectorize + Workers AI embeddings | Pencarian semantik tersuai berbanding semantic-lite semasa | Perlu pipeline chunks, ingestion, penghapusan, dedup, provenance dan quota; 30M queried dims/bulan dan 5M stored dims Free (tidak termasuk kos embeddings) | **Alternatif kepada AI Search, jangan buat kedua-duanya dahulu** |
| P2 | Durable Objects WebSockets / Agents | Penyelarasan voice/socket dan tugas berkeadaan di edge | Voice Live sekarang Google dan berfungsi; migrasi sockets boleh memecahkan sesi, latency dan resumption | **Tangguh** |
| P2 | Browser Run | Baca halaman JavaScript yang gagal dikendalikan oleh research fetch biasa, atau QA rendering | Risiko SSRF/robots/privacy, ada kos browser dan risiko memaparkan halaman berlesen/terkunci. Perlu domain allowlist dan had | **Owner-only research lebih sesuai** |
| P3 | R2 + Queues | Arkib imej, hasil Studio, background indexing terjadual | Perlu dasar penyimpanan, TTL, persetujuan pengguna, data deletion dan operasi berbayar jika skala meningkat | **Bukan keutamaan sekarang** |

## Perhatian teknikal
1. **10,000 neurons/hari** ialah peruntukan Workers AI percuma di seluruh akaun. Had 24 panggilan GLM/hari melindungi bilangan permintaan, bukan menjamin penggunaannya di bawah kuota neurons; Studio masih perlu ada rizab dan akaun perlu dipantau.
2. Jangan cache mana-mana prompt yang mengandungi sejarah chat, note peribadi, image URL atau memori pengguna. Cache hanya katalog/karya awam yang sama bagi semua pengguna.
3. Auto-routing Gateway tidak wajar menggantikan routing 3+1 dahulu, supaya keupayaan Gemini tools/media dan identiti CAHAYA/GELAP tidak bercelaru.
4. `Ready` = binding tersedia; `Connected` hanya selepas respons inferens betul-betul berjaya. Smoke test dua prompt sintetik mengukur satu sampel, bukan IQ/model benchmark.
5. Jangan buka endpoint admin kepada browser, jangan hantar API secrets ke frontend, dan jangan merge sebelum staging + smoke selesai.

## Rujukan utama
- https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/ai-gateway/features/
- https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/
- https://developers.cloudflare.com/ai-gateway/features/caching/
- https://developers.cloudflare.com/ai-search/platform/limits-pricing/
- https://developers.cloudflare.com/vectorize/platform/pricing/
- https://developers.cloudflare.com/turnstile/plans/
- https://developers.cloudflare.com/browser-run/
