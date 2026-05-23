// Hide the Windows console window in release builds. In debug builds we keep
// it so panics / Rust logs are visible.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jarvis_lib::run()
}
