# AKSARA Linux V3 · Absolute Improvement (PRE-ALPHA)

**Scope:** Aksara Android Native ARM64 preview. **Merge:** only after owner-device approval. **UI:** retain current Linux Liquid Glass screen and control deck. Reset/reinstalling experimental data is allowed.

## Implementation status

| Phase | Implementation in V3 | Verification |
| --- | --- | --- |
| P0 Filesystem/PRoot | Guest `TMPDIR=/tmp`, sticky /tmp, `--link2symlink`, private .l2s store, rootfs hardlink extraction fallback, install revision marker | Pending Android device hardlink/package checks |
| P1 Full prebuilt toolchain | Alpine ARM64 GCC/G++, Clang/LLVM, Rust/Cargo, Go, Node/npm, JDK, Python/pip/venv, Git/SSH, SQLite, CMake and CLI utilities | QEMU smoke in dedicated CI |
| P2 Runtime lifecycle | Reuse existing Termux PTY lifecycle and multiple sessions without UI modifications | Device restart and background testing pending |
| P3 Performance | Bounded process/file/runtime benchmark script included | Device baseline and subsequent optimization pending |
| P4 Workstation | Git, compilers, databases, SSH, local servers and shell tooling included | Working project validation pending |
| P5 Network/Integrity | Official Alpine repositories, checksum checked rootfs, private hardlink store, archive extraction limits and pinned PRoot source | Review/phone test pending |
| P6 CI | Dedicated Android Linux V3 workflow + smoke compiles C, C++, Clang, Rust, Go and checks filesystem | Workflow output is the source of truth |
| P7 Device QA | Procedure below | **Requires owner to install and test the APK; cannot be certified by CI** |

## On-device testing

After installing the V3 experimental APK, open Linux and enable/install Alpine. The bundled toolchain is prepared at GitHub Actions build time. It does not require downloading packages on first use.

```sh
# All compilers and filesystem operations are tested with real executables:
aksara-linux-smoke

# Bounded baseline for future optimization:
aksara-linux-benchmark

# Test repairing/installing/removing packages independently of the prebuilt image:
apk update
apk add --no-cache --virtual .aksara-dev-test tree
command -v tree
apk del .aksara-dev-test

# Git and local development:
git --version
python3 --version
gcc --version
clang --version
rustc --version
go version
```

For GitHub, clone a public repository into `/workspace`. Test `git status`, local commit and an HTTPS fetch; pushing should only be done deliberately with explicit credentials. Test a Python localhost HTTP server from a second terminal tab. Terminate it afterwards.

Repeat PTY launch/restart 10 times. Check package installation/repair, sessions, battery and thermal impact, storage, and visual parity with current Linux Liquid Glass UI. Check Chat, Voice, Neural, Studio, Today and Chess for regressions.

## Important design constraints

- PRoot is a userspace translation layer, **not Android system root**, and not a perfect security sandbox.
- The .l2s backing directory is private to the app. Its existence and permission are validated on session startup. PRoot guest hardlink emulation must still be validated against the real phone's SELinux rules.
- Stage/extract limits are 250,000 entries and 4 GiB uncompressed. These are defensive upper bounds, not preallocated storage. CI verifies rootfs SHA-256.
- Previous PRE-ALPHA image markers are invalidated. Reinstallation of Linux rootfs may discard old Linux package state; data migration is intentionally not required.
- Runtime tool compatibility differs between QEMU/Docker and Android PRoot. In particular, GDB/strace, background services, FUSE, Docker daemon and kernel facilities require separate capability checks.
- Target SDK 28 is an **experimental owner-only Android packaging compatibility path** inherited from the Linux preview. Updating to current target SDK has an unresolved native execution blocker; do not market this as Play Store ready.
- GPL PRoot source archives and attribution must ship alongside experimental APK artifacts.
- Preserve the Linux UI unless a specific usability defect is confirmed. No auto merge.
