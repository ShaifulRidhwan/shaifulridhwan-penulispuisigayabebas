"use strict";
/* Sanitized categories; never echo raw upstream errors, URLs, prompts or tokens. */
function category({status=0,code="",reason=""}={}){
 const n=Number(status)||0,c=String(code).toUpperCase(),r=String(reason).toLowerCase();
 if(c==="CANCELLED")return "cancelled";
 if(n===429||/QUOTA|RATE_LIMIT|BUSY/.test(c)||/quota|cooldown|rate_limit/.test(r))return "quota_or_rate_limit";
 if(n===413)return "payload_too_large";
 if(n===401||n===403||/auth|credential|access/.test(r))return "authentication";
 if(n===404||/model_unavailable|invalid_model/.test(r))return "model_unavailable";
 if(/region|location_restricted/.test(r))return "region_restricted";
 if(/vision|capability/.test(r)||c==="CAPABILITY_UNAVAILABLE")return "capability_unavailable";
 if(n===408||n===504||/timeout/.test(r))return "timeout";
 if(n===400||n===422||/invalid_request|thinking_parameter/.test(r))return "bad_request";
 if(n>=500||n===0)return "upstream_or_network";
 return "other";
}
function diagnose(data={},status=0){
 const failures=Array.isArray(data.providerFailures)?data.providerFailures:[];
 const recent=failures.length?failures[failures.length-1]:{};
 const kind=category({status:status||data.status,code:data.code,reason:recent.reason||recent.category||""});
 const actions={
  cancelled:"Permintaan dihentikan. Tiada percubaan semula automatik diperlukan.",
  quota_or_rate_limit:"Semak tempoh cooldown dan kuota sebenar; jangan ulang panggilan sebelum dibenarkan.",
  payload_too_large:"Kurangkan jumlah data atau gunakan teks setempat sebelum menghantar.",
  authentication:"Semak kunci dan kebenaran pada pelayan tanpa mendedahkan credential.",
  model_unavailable:"Semak model dan keupayaan endpoint sebelum mencuba lagi.",
  region_restricted:"Semak ketersediaan rasmi model bagi rantau ini. Jangan ulang permintaan tanpa perubahan.",
  capability_unavailable:"Semak sokongan media/model dan izin fallback; jangan hantar kepada penyedia lain tanpa izin.",
  timeout:"Permintaan tamat masa. Simpan mesej dan cuba semula secara terkawal.",
  bad_request:"Semak format payload, konfigurasi alat dan parameter model.",
  upstream_or_network:"Semak sambungan atau status penyedia; punca khusus belum disahkan.",
  other:"Maklumat tidak cukup untuk mengesahkan punca."
 };
 return Object.freeze({kind,action:actions[kind],scope:"sanitized_request_diagnostics",upstreamVerified:false});
}
module.exports={category,diagnose};
