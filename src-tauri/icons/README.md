# Tauri Icons

Tauri requires PNG/ICO/ICNS variants for every install target. Generate them
from a single 1024×1024 PNG:

```powershell
cargo install tauri-cli --version "^2"
cargo tauri icon path\to\source-icon.png
```

This populates the directory with `32x32.png`, `128x128.png`, `128x128@2x.png`,
`icon.ico` (Windows), and `icon.icns` (macOS). Until you do this, NSIS/MSI
builds will fail — `cargo tauri dev` falls back to a stock window glyph.
