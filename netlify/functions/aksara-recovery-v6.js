"use strict";
const Failure=require("./aksara-failure-diagnostics");
const Legacy=require("./aksara-intelligence-v5");
const ACTIONS=Object.freeze({
 quota_or_rate_limit:"Tunggu tempoh Retry-After sebenar dan semak had percuma; jangan putar kunci API untuk memintas kuota.",
 timeout:"Semak sambungan; pengguna boleh cuba semula secara manual selepas permintaan tamat sepenuhnya.",
 upstream_or_network:"Semak provider dan sambungan. Gunakan laluan fallback sedia ada jika layak, tanpa menghantar fail peribadi tanpa izin.",
 payload_too_large:"Kurangkan fail atau pecahkan dokumen sebelum menghantar semula.",
 authentication:"Semak credential pada server sahaja; jangan paparkan API key.",
 model_unavailable:"Semak ID model dan sokongan keupayaan; elakkan percubaan berulang tanpa perubahan.",
 bad_request:"Sahkan skema permintaan sebelum cuba semula.",
 cancelled:"Pengguna menghentikan permintaan; jangan ulang sendiri.",
 region_restricted:"Periksa sokongan rasmi penyedia di rantau ini; jangan ulang secara membuta tuli.",
 capability_unavailable:"Minta kebenaran yang jelas jika perlu menukar penyedia untuk lampiran.",
 other:"Maklumat punca belum cukup; semak diagnostik yang disanitasi."
});
function guide({status=0,code="",retryAfterSeconds=0,failures=[]}={}){
 const last=Array.isArray(failures)?failures.at(-1):null;
 const kind=Failure.category({status,code,reason:last?.reason||""});
 const old=Legacy.recoveryHint({status,code,retryAfterSeconds});
 const stream=code==="STREAM_INTERRUPTED";
 return Object.freeze({...old,kind,manualOnly:true,automaticRetry:false,
  preserveInput:true,streamMustNotSplice:stream,
  retryAfterSeconds:old.retryAfterSeconds||null,
  actionText:ACTIONS[kind]||ACTIONS.other,
  scope:"sanitized_guidance_not_proof_of_upstream_cause"});
}
module.exports={guide};
