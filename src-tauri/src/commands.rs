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
    launch_terminal(launch, tooling)
}

#[cfg(windows)]
fn launch_terminal(
    launch: am_proto::ProviderAccountAuthLaunch,
    tooling: bool,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
    let quote = |value: &str| format!("'{}'", value.replace('\'', "''"));
    let command = format!(
        "& {} {}",
        quote(&launch.binary),
        launch
            .args
            .iter()
            .map(|arg| quote(arg))
            .collect::<Vec<_>>()
            .join(" ")
    );
    let title = if tooling {
        format!("Perpetual - {}", launch.label)
    } else {
        format!("Perpetual - Sign in to {}", launch.label)
    };
    // Sign-in windows close themselves once the provider CLI succeeds; the
    // interactive CLI stays open until the user exits it.
    let script = if tooling {
        format!(
            "$Host.UI.RawUI.WindowTitle = {}; Write-Host {} -ForegroundColor DarkGray; {}",
            quote(&title),
            quote(&launch.instructions),
            command
        )
    } else {
        format!(
            "$Host.UI.RawUI.WindowTitle = {}; Write-Host {} -ForegroundColor DarkGray; {}; if ($LASTEXITCODE -eq 0) {{ exit }} else {{ Read-Host 'Sign-in did not finish. Press Enter to close' }}",
            quote(&title),
            quote(&launch.instructions),
            command
        )
    };
    let mut args = vec!["-NoProfile"];
    if tooling {
        args.push("-NoExit");
    }
    args.extend(["-Command", &script]);
    std::process::Command::new("powershell.exe")
        .args(args)
        .envs(launch.env)
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn launch_terminal(
    _launch: am_proto::ProviderAccountAuthLaunch,
    _tooling: bool,
) -> Result<(), String> {
    Err("Interactive account sign-in currently requires Windows. Claude setup tokens can be added in Accounts.".into())
}
