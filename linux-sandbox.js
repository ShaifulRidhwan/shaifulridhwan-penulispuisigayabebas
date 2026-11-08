/* AKSARA Linux Sandbox v1: real Buildroot guest on v86, no guest network card. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const bootButton = $("linuxBoot");
  const resetButton = $("linuxReset");
  const powerButton = $("linuxPower");
  const status = $("linuxStatus");
  const terminal = $("linuxTerminal");
  if (!bootButton || !resetButton || !powerButton || !status || !terminal) return;

  const assets = Object.freeze({
    script: "https://cdn.jsdelivr.net/npm/v86@0.5.472/build/libv86.js",
    wasm: "https://cdn.jsdelivr.net/npm/v86@0.5.472/build/v86.wasm",
    bios: "https://cdn.jsdelivr.net/gh/copy/v86@master/bios/seabios.bin",
    vga: "https://cdn.jsdelivr.net/gh/copy/v86@master/bios/vgabios.bin",
    kernel: "https://i.copy.sh/buildroot-bzimage68.bin"
  });
  let vm = null;
  let busy = false;
  let libraryPromise = null;
  let activeBoot = 0;

  const setStatus = (message, type = "idle") => {
    status.textContent = message;
    status.dataset.state = type;
  };
  const setControls = () => {
    bootButton.disabled = busy;
    resetButton.disabled = busy || !vm;
    powerButton.disabled = busy || !vm;
  };
  const getLibrary = () => {
    if (typeof window.V86 === "function") return Promise.resolve(window.V86);
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = assets.script;
        script.async = true;
        script.referrerPolicy = "no-referrer";
        script.onload = () => {
          if (typeof window.V86 === "function") resolve(window.V86);
          else reject(new Error("v86 tidak tersedia selepas library dimuatkan"));
        };
        script.onerror = () => reject(new Error("Gagal memuatkan library emulator"));
        document.head.appendChild(script);
      }).catch(error => {
        libraryPromise = null;
        throw error;
      });
    }
    return libraryPromise;
  };

  async function boot() {
    if (busy) return;
    busy = true;
    setControls();
    try {
      if (vm) {
        await vm.run();
        setStatus("Linux disambung semula.", "ready");
        terminal.focus();
        return;
      }
      setStatus("Memuatkan emulator dan Linux 32-bit. Muat turun pertama memerlukan internet...", "loading");
      const V86 = await getLibrary();
      const bootId = ++activeBoot;
      terminal.value = "";
      // Networking intentionally disabled for the sandbox guest.
      const instance = new V86({
        wasm_path: assets.wasm,
        memory_size: 64 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        bios: { url: assets.bios },
        vga_bios: { url: assets.vga },
        bzimage: { url: assets.kernel, async: false },
        serial_container: terminal,
        filesystem: {},
        cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
        autostart: true,
        disable_mouse: true
      });
      vm = instance;
      instance.add_listener("emulator-ready", () => {
        if (vm === instance && activeBoot === bootId) {
          setStatus("Emulator sedia. Menunggu terminal Linux selesai boot...", "loading");
          setControls();
        }
      });
      instance.add_listener("emulator-started", () => {
        if (vm === instance && activeBoot === bootId) {
          setStatus("Linux berjalan secara lokal tanpa akses rangkaian guest.", "ready");
          setControls();
        }
      });
      setControls();
      terminal.focus();
    } catch (error) {
      vm = null;
      setStatus("Boot gagal: " + (error?.message || "sumber tidak tersedia") + ". Cuba semula atau buka demo rasmi.", "error");
    } finally {
      busy = false;
      setControls();
    }
  }

  async function shutdown() {
    if (!vm || busy) return;
    busy = true;
    setControls();
    const oldVM = vm;
    vm = null;
    activeBoot++;
    try {
      await oldVM.stop();
      await oldVM.destroy();
      terminal.value = "";
      setStatus("Sesi Linux dimatikan. Fail sementara dalam VM tidak disimpan.", "idle");
    } catch (error) {
      setStatus("Sesi dihentikan, tetapi pembersihan VM mungkin tidak lengkap. Muat semula halaman jika perlu.", "error");
    } finally {
      busy = false;
      setControls();
    }
  }

  bootButton.addEventListener("click", boot);
  resetButton.addEventListener("click", () => {
    if (!vm || busy) return;
    try {
      vm.restart();
      setStatus("Linux sedang reboot...", "loading");
      terminal.focus();
    } catch (error) {
      setStatus("Gagal reboot: " + (error?.message || "ralat tidak diketahui"), "error");
    }
  });
  powerButton.addEventListener("click", shutdown);
  setControls();
})();
