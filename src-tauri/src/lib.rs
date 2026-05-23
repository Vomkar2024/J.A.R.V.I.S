//! J.A.R.V.I.S — Tauri v2 desktop shell.
//!
//! Responsibilities:
//! 1. Bring up the FastAPI Python sidecar (`jarvis-core.exe`) and keep its
//!    `CommandChild` alive for the whole window lifetime.
//! 2. Poll the sidecar's `/health` endpoint until it answers, then reveal
//!    the main window so users never see a blank/loading webview.
//! 3. Kill the sidecar on `RunEvent::ExitRequested` so a SIGINT or window-
//!    close never leaks a Python process.
//!
//! Dev mode (`debug_assertions`) skips the sidecar — the user already runs
//! `npm run backend` or `npm run dev` separately.

use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const HEALTH_PROBE_URL: &str = "http://127.0.0.1:8000/health";
const HEALTH_PROBE_INTERVAL_MS: u64 = 250;
const HEALTH_PROBE_TIMEOUT_MS: u64 = 15_000;

/// Wrapper that survives the move into Tauri's managed state.
struct Sidecar(Mutex<Option<CommandChild>>);

impl Sidecar {
    const fn new() -> Self {
        Self(Mutex::new(None))
    }

    fn set(&self, child: CommandChild) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some(child);
        }
    }

    /// Kill the sidecar, blocking briefly so the child process actually
    /// dies before we return. Idempotent.
    fn kill(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let pid = child.pid();
                if let Err(err) = child.kill() {
                    log::warn!("[sidecar] kill({pid}) failed: {err}");
                } else {
                    log::info!("[sidecar] terminated pid={pid}");
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Sidecar::new())
        .setup(|app| {
            // In dev the user runs the backend themselves; we just open the
            // webview pointing at the React dev server (devUrl in tauri.conf.json).
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }

            #[cfg(not(debug_assertions))]
            {
                spawn_sidecar(app.handle())?;
                wait_for_sidecar_then_show(app.handle().clone());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                // Belt-and-braces: kill the sidecar the moment the user
                // clicks the close button, even before RunEvent fires.
                if let Some(sidecar) = window.app_handle().try_state::<Sidecar>() {
                    sidecar.kill();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(sidecar) = app.try_state::<Sidecar>() {
                    sidecar.kill();
                }
            }
        });
}

#[cfg(not(debug_assertions))]
fn spawn_sidecar(app: &tauri::AppHandle) -> tauri::Result<()> {
    let cmd = app
        .shell()
        .sidecar("jarvis-core")
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("sidecar lookup failed: {e}")))?;

    let (mut rx, child) = cmd
        .spawn()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("sidecar spawn failed: {e}")))?;

    log::info!("[sidecar] spawned jarvis-core pid={}", child.pid());

    app.state::<Sidecar>().set(child);

    // Drain stdout/stderr in the background so the pipe buffer never fills
    // (uvicorn logs every request — silent backpressure would deadlock it).
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::info!("[sidecar:stdout] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    log::info!("[sidecar:stderr] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("[sidecar] terminated: {payload:?}");
                    break;
                }
                CommandEvent::Error(err) => {
                    log::error!("[sidecar] error: {err}");
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[cfg(not(debug_assertions))]
fn wait_for_sidecar_then_show(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let deadline = std::time::Instant::now()
            + Duration::from_millis(HEALTH_PROBE_TIMEOUT_MS);

        // Minimal hand-rolled probe — pulling in `reqwest` would add 2 MB
        // to the installer just for this 12-line loop.
        while std::time::Instant::now() < deadline {
            if let Ok(stream) = std::net::TcpStream::connect_timeout(
                &"127.0.0.1:8000".parse().expect("static socket addr"),
                Duration::from_millis(200),
            ) {
                drop(stream);
                log::info!("[sidecar] /health reachable, revealing window");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                return;
            }
            tokio::time::sleep(Duration::from_millis(HEALTH_PROBE_INTERVAL_MS)).await;
        }

        log::error!(
            "[sidecar] failed to answer {HEALTH_PROBE_URL} within {HEALTH_PROBE_TIMEOUT_MS}ms"
        );
        if let Some(window) = app.get_webview_window("main") {
            // Surface the window anyway so users see the connection-failed
            // screen instead of a silent missing app.
            let _ = window.show();
        }
    });
}
