#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod commands;

use am_core::AppCore;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::request,
            commands::sign_in,
            commands::data_dir
        ])
        .setup(|app| {
            // Desktop data is isolated from the extension: two schedulers must never own one DB.
            // PERPETUAL_DATA_DIR points a development or test run at a throwaway directory.
            let dir = match std::env::var_os("PERPETUAL_DATA_DIR") {
                Some(dir) if !dir.is_empty() => std::path::PathBuf::from(dir),
                _ => app.path().app_data_dir()?,
            };
            let core = tauri::async_runtime::block_on(AppCore::new(&dir))?;
            let mut events = core.events.subscribe();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    match events.recv().await {
                        Ok(event) => {
                            let _ = handle.emit("perpetual-event", event);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                            let _ = handle.emit("perpetual-refresh", ());
                        }
                        Err(_) => break,
                    }
                }
            });
            let power =
                tauri::async_runtime::block_on(async { am_daemon::power::spawn(core.clone()) });
            app.manage(commands::Engine {
                core,
                power: tokio::sync::Mutex::new(Some(power)),
            });
            app.manage(AtomicBool::new(false));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to start Perpetual");

    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let closing = app.state::<AtomicBool>();
            if !closing.swap(true, Ordering::SeqCst) {
                api.prevent_exit();
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let engine = handle.state::<commands::Engine>();
                    let _ = engine.core.prepare_shutdown().await;
                    if let Some(power) = engine.power.lock().await.take() {
                        power.shutdown().await;
                    }
                    engine.core.shutdown().await;
                    handle.exit(0);
                });
            }
        }
    });
}
