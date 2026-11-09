// Preserve the original test entry point with the V2 controls and full-health fight coverage.
const {spawnSync}=require('node:child_process');const path=require('node:path');
for(const script of ['eclipse-browser.cjs','eclipse-gameplay.cjs','recovery.cjs']){const r=spawnSync(process.execPath,[path.join(__dirname,script)],{stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status||1)}
