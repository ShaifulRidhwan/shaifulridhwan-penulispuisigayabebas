const DEFAULT_MODEL = 'gemini-3.8-flash';
 exports.handler = async (event) => {
   const reqId = Date.now();
   const fetchStart = reqId;
   console.log(`[${reqId}] start probe=${event.headers['x-probe'] === 'true' || false}`);
   // Tolak kaedah selain POST
   if (event.httpMethod !== 'POST') {
     return { 
       statusCode: 405, 
       headers: { 'Allow': 'POST' },
       body: JSON.stringify({ ok: false, diagnostic: 'method_not_allowed' }) 
     };
   }
   // Baca API key — JANGAN sesekali log atau paparkan nilainya
   const apiKey = process.env.GEMINI_API_KEY;
   if (!apiKey) {
     console.log(`[${reqId}] ralat: GEMINI_API_KEY tidak ditemui dalam persekitaran`);
     return { 
       statusCode: 503, 
       body: JSON.stringify({ ok: false, diagnostic: 'env_missing_key' }) 
     };
   }
   // Parse badan permintaan
   let body;
   try {
     body = JSON.parse(event.body || '{}');
   } catch (e) {
     console.log(`[${reqId}] ralat: format JSON tidak sah`);
     return { 
       statusCode: 400, 
       body: JSON.stringify({ ok: false, diagnostic: 'invalid_json_body' }) 
     };
   }
   // Tentukan model & endpoint
   const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
   const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
   console.log(`[${reqId}] gemini-call model=${model} timeoutMs=${GEMINI_TIMEOUT}`);
   // Tetapkan pengawal masa tamat
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT);
   let response = null;
   let fetchError = null;
   let httpStatus = null;
   let totalMs = 0;
   try {
     // Hantar permintaan ke Gemini API
     response = await fetch(endpoint, {
       method: 'POST',
       signal: controller.signal,
       headers: {
         'x-goog-api-key': apiKey,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         contents: [{
           parts: [{ 
             text: body.probe 
               ? 'Balas dengan perkataan OK sahaja.'
               : body.question 
           }]
         }],
         generationConfig: body.probe
           ? { maxOutputTokens: 8, temperature: 0.1 }
           : { maxOutputTokens: 1024, temperature: 0.7 }
       })
     });
     httpStatus = response.status;
     totalMs = Date.now() - fetchStart;
   } catch (err) {
     fetchError = err;
     totalMs = Date.now() - fetchStart;
   } finally {
     clearTimeout(timeoutId);
   }
   // ======================================================
   // KATEGORI 1: Timeout / sambungan terhenti tanpa respons
   // ======================================================
   if (fetchError) {
     if (fetchError.name === 'AbortError') {
       console.log(`[${reqId}] gemini-timeout model=${model} totalMs=${totalMs}ms`);
       return {
         statusCode: 200,
         body: JSON.stringify({
           ok: false,
           diagnostic: 'timeout_no_response',
           model: model,
           totalMs: totalMs,
           httpStatus: null,
           message: 'Permintaan tamat masa — tiada respons diterima daripada Gemini dalam 15 saat.'
         })
       };
     } else {
       console.log(`[${reqId}] network-error model=${model} totalMs=${totalMs}ms jenis=${fetchError.name}`);
       return {
         statusCode: 502,
         body: JSON.stringify({
           ok: false,
           diagnostic: 'network_connection_failed',
           model: model,
           totalMs: totalMs,
           httpStatus: null,
           message: 'Gagal menyambung ke pelayan Gemini.',
           detail: fetchError.message.substring(0, 60)
         })
       };
     }
   }
   // ======================================================
   // KATEGORI 2: Respons diterima tetapi dengan kod ralat
   // ======================================================
   if (!response.ok) {
     let errText = '';
     try { errText = await response.text(); } catch {}
     const diagnostic = {
       400: 'bad_request',
       401: 'unauthorized_api_key',
       403: 'forbidden_restriction',
       404: 'model_or_endpoint_not_found',
       429: 'quota_exceeded',
       500: 'gemini_server_error',
       503: 'service_unavailable'
     }[httpStatus] || `http_error_${httpStatus}`;
     console.log(`[${reqId}] gemini-http-error model=${model} status=${httpStatus} totalMs=${totalMs}ms`);
     return {
       statusCode: 200,
       body: JSON.stringify({
         ok: false,
         diagnostic: diagnostic,
         model: model,
         httpStatus: httpStatus,
         totalMs: totalMs,
         errorPreview: errText.substring(0, 150)
       })
     };
   }
   // ======================================================
   // KATEGORI 3: Respons BERJAYA diterima (2xx)
   // ======================================================
   let responseText = '';
   let parseOk = true;
   try {
     const json = await response.json();
     responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
   } catch (e) {
     parseOk = false;
     console.log(`[${reqId}] parse-error model=${model} totalMs=${totalMs}ms`);
   }
   console.log(`[${reqId}] gemini-success model=${model} status=${httpStatus} totalMs=${totalMs}ms parseOk=${parseOk}`);
   return {
     statusCode: 200,
     body: JSON.stringify({
       ok: true,
       model: model,
       httpStatus: httpStatus,
       totalMs: totalMs,
       parseOk: parseOk,
       text: responseText.trim()
     })
   };
 };
