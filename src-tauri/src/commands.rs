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

/// Where the engine keeps its database and account profiles.
#[tauri::command]
pub fn data_dir(engine: State<'_, Engine>) -> String {
    engine.core.data_dir().to_string_lossy().into_owned()
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

/// Opens Terminal with a one-shot script. The script lives in a private
/// temporary folder, is readable only by the user, and deletes itself as soon
/// as it starts, because it can carry an account's environment.
#[cfg(target_os = "macos")]
fn launch_terminal(
    launch: am_proto::ProviderAccountAuthLaunch,
    tooling: bool,
) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
    // Single-quote for bash: ' becomes '\''.
    let quote = |value: &str| format!("'{}'", value.replace('\'', r"'\''"));
    let dir = std::env::temp_dir().join("perpetual-sign-in");
    std::fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(&dir)
        .map_err(|error| error.to_string())?;
    let path = dir.join(format!("{}.command", am_proto::new_id()));
    let mut lines = vec![
        "#!/bin/bash".to_string(),
        r#"rm -f -- "$0""#.to_string(),
        "clear".to_string(),
    ];
    for (key, value) in &launch.env {
        if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err("Invalid environment for the sign-in terminal".into());
        }
        lines.push(format!("export {key}={}", quote(value)));
    }
    lines.push(format!(r"printf '%s\n\n' {}", quote(&launch.instructions)));
    let command = std::iter::once(quote(&launch.binary))
        .chain(launch.args.iter().map(|arg| quote(arg)))
        .collect::<Vec<_>>()
        .join(" ");
    if tooling {
        lines.push(format!("exec {command}"));
    } else {
        lines.push(command);
        lines.push(
            r"if [ $? -eq 0 ]; then printf '\nSigned in. You can close this window.\n'; else read -r -p $'\nSign-in did not finish. Press Return to close. '; fi"
                .to_string(),
        );
    }
    let script = lines.join("\n") + "\n";
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o700)
        .open(&path)
        .map_err(|error| error.to_string())?;
    file.write_all(script.as_bytes())
        .map_err(|error| error.to_string())?;
    drop(file);
    std::process::Command::new("open")
        .args(["-a", "Terminal"])
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn launch_terminal(
    _launch: am_proto::ProviderAccountAuthLaunch,
    _tooling: bool,
) -> Result<(), String> {
    Err("Interactive sign-in is available on Windows and macOS. Claude setup tokens can be added in Accounts.".into())
}
