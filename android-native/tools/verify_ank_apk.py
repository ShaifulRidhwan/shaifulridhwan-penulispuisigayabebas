#!/usr/bin/env python3
"""ANK APK inventory guard. Never impose an arbitrary APK size limit.

Checks ZIP metadata only, without decompressing the >500 MB Alpine bundle.
"""
from __future__ import annotations
from collections import Counter
from pathlib import Path
import os
import sys
import tempfile
import zipfile

REQUIRED = (
    "assets/linux/alpine-minirootfs.bundle",
    "assets/linux/alpine-minirootfs.sha256",
    "assets/linux/alpine-minirootfs.entries",
    "lib/arm64-v8a/libaksara_proot.so",
    "lib/arm64-v8a/libaksara_proot_loader.so",
)

def verify(path: str, require_runtime: bool = False) -> dict:
    with zipfile.ZipFile(path) as apk:
        entries = [record.filename for record in apk.infolist() if not record.is_dir()]
        count = Counter(entries)
        staged = [count[name] for name in REQUIRED]
        # Ordinary Android PR builds are compile-only; the owner workflow
        # stages Alpine/PRoot separately. A partial or duplicate staged
        # runtime is ALWAYS a failure, not a valid APK for device QA.
        complete = all(value == 1 for value in staged)
        unstaged = all(value == 0 for value in staged)
        errors = []
        if not complete and (require_runtime or not unstaged):
            errors += [f"{name} expected once, found {count[name]}" for name in REQUIRED
                       if count[name] != 1]
        extra_roots = [name for name in entries if
                       ("rootfs" in name.lower() or "minirootfs" in name.lower()) and
                       name not in REQUIRED]
        if extra_roots:
            errors.append("Unexpected rootfs file(s): " + repr(extra_roots[:8]))
        other_proots = [name for name in entries if
                        name.rsplit("/", 1)[-1] in
                        ("libaksara_proot.so", "libaksara_proot_loader.so") and
                        name not in REQUIRED]
        if other_proots:
            errors.append("Duplicate PRoot runtime: " + repr(other_proots[:8]))
        embedded_models = [name for name in entries if
                           name.startswith("assets/") and
                           name.lower().endswith((".gguf", ".safetensors"))]
        if embedded_models:
            errors.append("New embedded LLM model(s): " + repr(embedded_models[:8]))
        if errors:
            raise ValueError("ANK APK integrity check failed:\n" + "\n".join(errors))
        root = apk.getinfo(REQUIRED[0]) if complete else None
        return {
            "apk_bytes": os.path.getsize(path),
            "runtime_staged": complete,
            "linux_bundle_zip_bytes": root.compress_size if root else 0,
            "linux_bundle_uncompressed_bytes": root.file_size if root else 0,
            "proot_pairs": 1 if complete else 0,
        }

def selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        good = Path(tmp) / "good.apk"
        with zipfile.ZipFile(good, "w") as archive:
            for path in REQUIRED:
                archive.writestr(path, "mock")
        assert verify(str(good))["proot_pairs"] == 1
        bad = Path(tmp) / "bad.apk"
        with zipfile.ZipFile(bad, "w") as archive:
            for path in REQUIRED:
                archive.writestr(path, "mock")
            archive.writestr("assets/linux/second-rootfs.bundle", "not allowed")
        try:
            verify(str(bad))
        except ValueError:
            pass
        else:
            raise AssertionError("Duplicate rootfs guard did not fail")
    print("ANK APK guard self-test PASS")

if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        selftest()
    elif len(sys.argv) == 2:
        summary = verify(sys.argv[1])
        for label, value in summary.items():
            print(f"{label}={value}")
        print("ANK APK guard PASS: " +
              ("full Linux owner build" if summary["runtime_staged"]
               else "compile-only CI; NOT a Linux-capable owner APK"))
    elif len(sys.argv) == 3 and sys.argv[1] == "--require-runtime":
        summary = verify(sys.argv[2], require_runtime=True)
        for label, value in summary.items():
            print(f"{label}={value}")
        print("ANK owner APK guard PASS: Alpine and PRoot verified")
    else:
        raise SystemExit("Usage: verify_ank_apk.py [--require-runtime] app-debug.apk | --self-test")
