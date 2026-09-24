use am_daemon::protocol::{DaemonRequest, DaemonResponse};
use tauri::State;

pub struct Engine {
    pub core: am_core::AppCore,
    pub power: tokio::sync::Mutex<Option<am_daemon::power::PowerMonitor>>,
}

#[tauri::command]
pub async fn request(
    engine: State<'_, Engine>,
    request: DaemonRequest,
) -> Result<DaemonResponse, String> {
    // These contain native environment values; keep them out of the webview.
    if matches!(
        request,
        DaemonRequest::ProviderAccountAuthLaunch { .. }
            | DaemonRequest::ProviderAccountToolingLaunch { .. }
    ) {
        return Err("Use the native sign-in command".into());
    }
    am_daemon::dispatch(&engine.core, request).await
}

#[tauri::command]
pub async fn sign_in(
    engine: State<'_, Engine>,
    account_id: String,
    tooling: bool,
) -> Result<(), String> {
    let req = if tooling {
        DaemonRequest::ProviderAccountToolingLaunch { account_id }
    } else {
        DaemonRequest::ProviderAccountAuthLaunch { account_id }
    };
    let response = am_daemon::dispatch(&engine.core, req).await?;
    let launch = match response {
        DaemonResponse::ProviderAccountAuthLaunch(value)
        | DaemonResponse::ProviderAccountToolingLaunch(value) => value,
        _ => return Err("Unexpected sign-in response".into()),
    };
    launch_terminal(launch)
}

#[cfg(windows)]
fn launch_terminal(launch: am_proto::ProviderAccountAuthLaunch) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let quote = |value: &str| format!("'{}'", value.replace('\'', "''"));
    let script = format!(
        "& {} {}",
        quote(&launch.binary),
        launch
            .args
            .iter()
            .map(|arg| quote(arg))
            .collect::<Vec<_>>()
            .join(" ")
    );
    std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NoExit", "-Command", &script])
        .envs(launch.env)
        .creation_flags(0x00000010)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn launch_terminal(_launch: am_proto::ProviderAccountAuthLaunch) -> Result<(), String> {
    Err("Interactive account sign-in currently requires Windows. Claude setup tokens can be added in Accounts.".into())
}
