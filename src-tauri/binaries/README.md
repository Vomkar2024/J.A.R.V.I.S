# Tauri Sidecar Binaries

This directory holds the PyInstaller-compiled FastAPI core that Tauri ships
inside the MSI/NSIS installer as a **sidecar**.

## File naming

Tauri's `externalBin` requires platform-suffixed names — the bundler picks
the right one per target:

```
binaries/
├── jarvis-core-x86_64-pc-windows-msvc.exe   ← built by `npm run sidecar:build`
├── jarvis-core-aarch64-apple-darwin         (future)
├── jarvis-core-x86_64-apple-darwin          (future)
└── jarvis-core-x86_64-unknown-linux-gnu     (future)
```

The `tauri.conf.json` reference is just `binaries/jarvis-core` — Tauri appends
the host triple at build time.

## How to (re)build

From the repo root:

```powershell
npm run sidecar:build
```

This runs [`backend/build-sidecar.ps1`](../../backend/build-sidecar.ps1), which:

1. Invokes PyInstaller against [`backend/jarvis_core.spec`](../../backend/jarvis_core.spec).
2. Renames the output to the host-triple convention.
3. Copies it next to this README.

## Why not check the binary in?

The compiled binary is 50–80 MB and rebuilt on every dependency bump. Build
it locally — `.gitignore` excludes the binaries, keeps this README.
