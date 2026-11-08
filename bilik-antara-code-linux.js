/* AKSARA Code Engine · Linux Developer Sandbox / v86. No network interface to the guest. */
(() => {
 "use strict";
 const VM_LIBRARY = "https://cdn.jsdelivr.net/npm/v86@0.5.473/build/libv86.js";
 const IMAGES = Object.freeze({
  wasm: "https://cdn.jsdelivr.net/npm/v86@0.5.473/build/v86.wasm",
  bios: "https://cdn.jsdelivr.net/gh/copy/v86@master/bios/seabios.bin",
  vga: "https://cdn.jsdelivr.net/gh/copy/v86@master/bios/vgabios.bin",
  kernel: "https://i.copy.sh/buildroot-bzimage68.bin"
 });
 const menuState = () => document.getElementById("codeLinuxState");
 const dialog = document.createElement("dialog");
 dialog.id = "codeLinuxDialog";
 dialog.className = "multi-ai-dialog code-linux-dialog";
 dialog.setAttribute("aria-labelledby", "clTitle");
 dialog.innerHTML = [
  '<header class="multi-ai-head"><div><strong id="clTitle">Linux · Developer Sandbox</strong><p>Buildroot Linux x86 sebenar melalui WebAssembly. Boot atas permintaan, tanpa sambungan rangkaian guest.</p></div><button type="button" id="clClose" aria-label="Tutup Linux">×</button></header>',
  '<div class="cl-statusbar"><span class="cl-light" id="clLight" aria-hidden="true"></span><span id="clStatus" role="status" aria-live="polite">VM OFF · Belum dimulakan</span><span id="clUptime">Uptime: 00:00</span></div>',
  '<div class="cl-actions"><label>RAM <select id="clRam"><option value="64">64 MB · Ringan</option><option value="128" selected>128 MB · Standard</option><option value="256">256 MB · Tinggi</option></select></label><button type="button" id="clBoot" class="cl-primary">▶ Boot Linux</button><button type="button" id="clPause" disabled>Jeda</button><button type="button" id="clRestart" disabled>Restart</button><button type="button" id="clStop" disabled>Power Off</button></div>',
  '<div class="cl-metrics" aria-label="Metrik VM"><span id="clCpu">CPU: x86 Virtual</span><span id="clRamInfo">RAM: 128 MB</span><span id="clInstructions">Instructions: —</span></div>',
  '<label for="clConsole" class="cl-console-label">LIVE SERIAL CONSOLE <span>ttyS0 · Guest Linux</span></label>',
  '<textarea id="clConsole" class="cl-console" readonly spellcheck="false" aria-label="Output konsol Linux" placeholder="Linux belum dimulakan. Tekan Boot Linux untuk bermula."></textarea>',
  '<form id="clCommandForm" class="cl-command"><label for="clCommand">root@aksara:~#</label><input id="clCommand" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Arahan shell selepas Linux boot" disabled maxlength="1000"><button type="submit" id="clSend" disabled>Run ↵</button></form>',
  '<div class="cl-shortcuts" aria-label="Arahan diagnostik pantas"><button data-cl-command="uname -a">Kernel</button><button data-cl-command="pwd">PWD</button><button data-cl-command="ls -la">Fail</button><button data-cl-command="free -m">RAM Guest</button><button data-cl-command="df -h">Disk Guest</button><button data-cl-command="ps">Proses</button></div>',
  '<div class="cl-secondary"><button id="clCopy" type="button">Salin Output</button><button id="clExport" type="button">Eksport Log</button><button id="clClear" type="button">Kosongkan Paparan</button><button id="clSave" type="button" disabled>Simpan State</button><label class="cl-import" for="clRestore">Pulihkan State<input type="file" id="clRestore" accept=".bin,.v86,application/octet-stream" hidden disabled></label></div>',
  '<p class="cl-note">Developer VM eksperimen. Shell menjalankan arahan dalam Linux guest sahaja, bukan telefon atau pelayan. Tiada network adapter, tiada root host, tiada compiler tambahan dijamin. Boot pertama memuat turun emulator, BIOS dan imej Linux dari sumber luar. Keadaan VM hilang apabila Power Off kecuali state dieksport secara manual. Fail state mungkin besar serta mengandungi data sensitif.</p>'
 ].join("");
 document.body.appendChild(dialog);
 const $ = id => dialog.querySelector("#" + id);
 const controls = {boot:$("clBoot"),pause:$("clPause"),restart:$("clRestart"),stop:$("clStop"),send:$("clSend"),command:$("clCommand"),ram:$("clRam"),save:$("clSave"),restore:$("clRestore"),console:$("clConsole")};
 let vm = null, session = 0, starting = false, stopped = false, paused = false, shellReady = false, loading = null;
 let bootAt = 0, ticker = null, watchdog = null, lastPrompt = "", commandHistory = [], historyIndex = 0;
 let lastCounter = 0, lastCounterAt = 0;
 const display = (message, kind = "idle") => {
  $("clStatus").textContent = message;
  dialog.dataset.state = kind;
  const state = menuState();
  if (state) {
   state.textContent = kind === "ready" ? "Running · Linux" : kind === "loading" ? "Booting…" : kind === "error" ? "Error" : "On Demand · VM";
   state.classList.toggle("is-ready", kind === "ready");
  }
 };
 function controlsSync() {
  const alive = Boolean(vm);
  controls.boot.disabled = starting || (alive && !paused);
  controls.boot.textContent = paused ? "▶ Sambung" : "▶ Boot Linux";
  controls.pause.disabled = starting || !alive || paused;
  controls.restart.disabled = starting || !alive;
  controls.stop.disabled = starting || !alive;
  controls.ram.disabled = starting || alive;
  controls.command.disabled = !shellReady || starting || paused;
  controls.send.disabled = controls.command.disabled;
  controls.save.disabled = starting || !alive;
  controls.restore.disabled = starting || !alive;
  $("clRamInfo").textContent = "RAM: " + controls.ram.value + " MB";
 }
 function append(data) {
  const area = controls.console;
  const wasBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;
  area.value = (area.value + data).slice(-130000);
  if (wasBottom) area.scrollTop = area.scrollHeight;
  lastPrompt = (lastPrompt + data).slice(-300);
  if (!shellReady && /(?:~% |(?:^|\n)[^\n]{0,100}[#$] )$/.test(lastPrompt)) {
   shellReady = true;
   display("Linux shell siap · ttyS0", "ready");
   controlsSync();
  }
 }
 function clearTimers() {
  if (ticker !== null) clearInterval(ticker);
  if (watchdog !== null) clearTimeout(watchdog);
  ticker = watchdog = null;
 }
 function pad(value) { return String(Math.floor(value)).padStart(2,"0"); }
 function stats() {
  if (!vm || !bootAt) return;
  const seconds = Math.floor((Date.now() - bootAt)/1000);
  $("clUptime").textContent = "Sesi: " + pad(seconds / 60) + ":" + pad(seconds % 60);
  if (typeof vm.get_instruction_counter === "function") {
   const count = vm.get_instruction_counter();
   const now = performance.now();
   const rate = lastCounterAt && now > lastCounterAt ? Math.max(0,Math.round((count - lastCounter) / ((now-lastCounterAt)/1000)/1000000)) : null;
   $("clInstructions").textContent = "Instruksi: " + Math.round(count/1000000) + "M" + (rate === null ? "" : " · " + rate + " M/s");
   lastCounter = count;
   lastCounterAt = now;
  }
 }
 function getLibrary() {
  if (typeof window.V86 === "function") return Promise.resolve(window.V86);
  if (!loading) loading = new Promise((resolve,reject) => {
   const src = document.createElement("script");
   src.src = VM_LIBRARY;
   src.async = true;
   src.referrerPolicy = "no-referrer";
   src.onload = () => typeof window.V86 === "function" ? resolve(window.V86) : reject(Error("Emulator v86 tidak ditemui."));
   src.onerror = () => reject(Error("Library v86 gagal dimuatkan. Semak rangkaian atau CSP."));
   document.head.appendChild(src);
  }).catch(error => { loading = null; throw error; });
  return loading;
 }
 async function boot() {
  if (starting) return;
  if (vm && paused) {
   try { await vm.run(); paused = false; display(shellReady ? "Linux shell disambung" : "Linux sedang boot",shellReady?"ready":"loading"); controlsSync(); }
   catch(error) { display("Resume gagal: " + error.message, "error"); }
   return;
  }
  if (vm) return;
  starting = true;
  stopped = false;
  shellReady = false;
  session++;
  const epoch = session;
  controls.console.value = "";
  lastPrompt = "";
  controlsSync();
  display("Memuatkan emulator · BIOS · kernel Linux…", "loading");
  try {
   const V86 = await getLibrary();
   if (epoch !== session) return;
   const instance = new V86({
    wasm_path: IMAGES.wasm,
    bios: {url:IMAGES.bios},
    vga_bios: {url:IMAGES.vga},
    bzimage: {url:IMAGES.kernel,async:false},
    filesystem: {},
    memory_size: Number(controls.ram.value)*1024*1024,
    vga_memory_size: 2*1024*1024,
    cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
    autostart: true
   });
   vm = instance;
   bootAt = Date.now();
   lastCounterAt = lastCounter = 0;
   $("clUptime").textContent = "Sesi: 00:00";
   ticker = setInterval(stats, 2000);
   watchdog = setTimeout(() => {
    if (vm === instance && !shellReady) display("Linux belum sampai prompt shell. Semak log serial; mungkin imej gagal boot.", "error");
   }, 80000);
   instance.add_listener("serial0-output-byte", byte => {
    if (vm !== instance || session !== epoch) return;
    const ch = String.fromCharCode(byte);
    if (ch !== "\r") append(ch);
   });
   instance.add_listener("emulator-ready", () => { if (vm === instance) display("VM tersedia · Menunggu shell Linux…", "loading"); });
   instance.add_listener("emulator-started", () => { if (vm === instance) display("Kernel sedang boot · Menunggu prompt shell…", "loading"); });
   instance.add_listener("emulator-stopped", () => { if (vm === instance && !stopped) { paused = true; display("VM dihentikan sementara", "idle"); controlsSync(); } });
   controlsSync();
  } catch(error) {
   display("Boot gagal: " + String(error?.message || error), "error");
   vm = null;
   clearTimers();
  } finally { starting = false; controlsSync(); }
 }
 function send(command) {
  const input = String(command || "").trim();
  if (!vm || !shellReady || paused || !input || input.length > 1000) return;
  commandHistory.push(input);
  if(commandHistory.length > 80) commandHistory.shift();
  historyIndex = commandHistory.length;
  vm.serial0_send(input + "\n");
  controls.command.value = "";
  controls.command.focus();
 }
 async function pause() {
  if (!vm || starting || paused) return;
  starting = true; controlsSync();
  try { await vm.stop(); paused=true; display("VM dijeda. RAM guest masih dalam browser.", "idle"); }
  catch(error) { display("Jeda gagal: " + error.message, "error"); }
  finally { starting=false; controlsSync(); }
 }
 async function shutdown() {
  if (!vm || starting) return;
  starting=true; stopped=true; session++; controlsSync();
  const prior = vm;
  try { await prior.stop(); await prior.destroy(); display("VM OFF · Sesi Linux dimatikan.", "idle"); }
  catch(error) { display("Gagal melepaskan sumber VM: " + error.message, "error"); }
  finally {
   vm=null; shellReady=false; paused=false; starting=false; bootAt=0;
   clearTimers(); controls.command.value=""; controlsSync();
  }
 }
 async function save() {
  if(!vm || starting) return;
  starting=true; controlsSync();
  try {
   display("Menyimpan snapshot memori VM…", "loading");
   const state=await vm.save_state();
   const url=URL.createObjectURL(new Blob([state],{type:"application/octet-stream"}));
   const a=document.createElement("a"); a.href=url; a.download="aksara-linux-v86-state.bin"; a.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   display(shellReady ? "Snapshot disimpan · Linux aktif" : "Snapshot disimpan",shellReady?"ready":"idle");
  } catch(error) { display("Snapshot gagal: " + error.message, "error"); }
  finally { starting=false; controlsSync(); }
 }
 async function restore(file) {
  if(!vm || starting || !file) return;
  if(file.size > 350*1024*1024) { display("Fail state melebihi 350 MB.", "error"); return; }
  starting=true; controlsSync();
  try {
   display("Memulihkan state VM…", "loading");
   const data=await file.arrayBuffer();
   await vm.stop();
   await vm.restore_state(data);
   await vm.run();
   paused=false;
   shellReady=false;
   lastPrompt="";
   display("State dipulihkan. Semak konsol Linux untuk status shell.", "loading");
  } catch(error) {
   display("State tidak sepadan dengan RAM/versi VM atau rosak: "+error.message, "error");
   paused=true;
  } finally { starting=false; controls.restore.value=""; controlsSync(); }
 }
 $("clClose").addEventListener("click",()=>dialog.close());
 dialog.addEventListener("click",e=>{ if(e.target===dialog) dialog.close(); });
 controls.boot.addEventListener("click",boot);
 controls.pause.addEventListener("click",pause);
 controls.stop.addEventListener("click",shutdown);
 controls.restart.addEventListener("click",()=>{
  if(!vm || starting) return;
  try { shellReady=false; lastPrompt=""; vm.restart(); display("Linux restart…", "loading"); controlsSync(); }
  catch(error){ display("Restart gagal: "+error.message,"error"); }
 });
 $("clCommandForm").addEventListener("submit",event=>{ event.preventDefault(); send(controls.command.value); });
 controls.command.addEventListener("keydown",event=>{
  if(event.key==="ArrowUp" && commandHistory.length) {
   event.preventDefault();historyIndex=Math.max(0,historyIndex-1);controls.command.value=commandHistory[historyIndex]||"";
  } else if(event.key==="ArrowDown" && commandHistory.length){
   event.preventDefault();historyIndex=Math.min(commandHistory.length,historyIndex+1);controls.command.value=commandHistory[historyIndex]||"";
  }
 });
 dialog.querySelectorAll("[data-cl-command]").forEach(button=>button.addEventListener("click",()=>send(button.dataset.clCommand)));
 $("clCopy").addEventListener("click",async()=>{ try{await navigator.clipboard.writeText(controls.console.value);display("Output disalin.",shellReady?"ready":"idle");}catch(_){display("Salin gagal. Gunakan Eksport Log.","error");}});
 $("clClear").addEventListener("click",()=>{controls.console.value="";lastPrompt="";});
 $("clExport").addEventListener("click",()=>{
  const url=URL.createObjectURL(new Blob([controls.console.value],{type:"text/plain;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="aksara-linux-console.txt";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 });
 $("clSave").addEventListener("click",save);
 $("clRestore").addEventListener("change",event=>restore(event.target.files?.[0]));
 controls.ram.addEventListener("change",controlsSync);
 window.addEventListener("aksara:code-linux-open",()=>{
  if(!dialog.open)dialog.showModal();
  controlsSync();
 });
 window.addEventListener("pagehide",()=>{if(vm){vm.stop().then(()=>vm.destroy()).catch(()=>{});vm=null;clearTimers();}});
 controlsSync();
})();