# Perpetual

A desktop workspace for Windows and macOS for long-running Codex and Claude Code tasks. Perpetual keeps a task's conversation, workspace, and queued messages together, and when an account reaches its usage limit it continues on your next account.

## Install

Download the latest release from [Releases](https://github.com/SakethSripada/Perpetual-Desktop/releases):

- **Windows:** run the `.exe` installer. It installs for your account only and doesn't need administrator rights.
- **macOS 11 or later:** open the `.dmg` and drag Perpetual to Applications.

The current installers are unsigned. After checking the download as described below, Windows users who trust the GitHub release can choose **More info → Run anyway** on the “Windows protected your PC” SmartScreen prompt. Some managed PCs or Windows 11 Smart App Control settings may not offer that option; don't disable system protection to install Perpetual. On macOS, after attempting to open the app, use **System Settings → Privacy & Security → Open Anyway** if you trust the verified download. These steps do not make an unsigned app signed or remove the warning for other users. See [Microsoft's SmartScreen guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) and [Apple's instructions](https://support.apple.com/en-us/102445).

You also need at least one of:

- [Codex CLI](https://developers.openai.com/codex/cli)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup)

If the CLI is already signed in, Perpetual picks up that account automatically. Models are read from the CLIs you have installed, so new models show up as soon as you update the CLI.

### Verify your download

Each release lists the SHA-256 hash of every download in `SHA256SUMS.txt`. To check your copy:

```sh
Get-FileHash .\Perpetual_0.1.0_x64-setup.exe -Algorithm SHA256   # Windows (PowerShell)
shasum -a 256 Perpetual_0.1.0_universal.dmg                       # macOS
```

Release builds are made by GitHub Actions from this repository. You can confirm that with the [GitHub CLI](https://cli.github.com/):

```sh
gh attestation verify Perpetual_0.1.0_x64-setup.exe --repo SakethSripada/Perpetual-Desktop
```

## Accounts

- **Several accounts per provider.** Each account you add signs in separately, in its own profile.
- **Switch any time.** Pick the account to use from the sidebar, the composer, or **Accounts**. The next message uses it.
- **Automatic switching.** When an account reaches its usage limit, the task continues on the next ready account in your switching order. If every account is limited, it resumes when the first one resets.

Sign-ins stay on your computer. Setup tokens are stored in Windows Credential Manager or the macOS Keychain, not in Perpetual's database.

## Build from source

Requirements: Git, Node.js 22.13+ (22.x), 24.x, or 26+, and [rustup](https://rustup.rs/) (which installs Rust 1.96.1 from `rust-toolchain.toml`). On Windows, install Visual Studio Build Tools with the **Desktop development with C++** workload. On macOS, install the Xcode Command Line Tools.

In PowerShell or macOS Terminal, clone the repository and run the desktop app:

```sh
git clone --branch dev https://github.com/SakethSripada/Perpetual-Desktop.git
cd Perpetual-Desktop
npm start
```

`npm start` checks the prerequisites, installs the pinned Rust toolchain and JavaScript dependencies, then opens the desktop app. Missing system tools produce instructions before any build begins. The first Rust build takes several minutes; later launches are much faster. Use `npm run setup` to prepare without launching and `npm run doctor` to check your installation. After setup, `npm run desktop` launches directly without reinstalling dependencies.

Run `npm run bundle` in that same folder to build an installer or app into `target/release/bundle/`. `npm run dev` opens a browser preview of the interface without the engine. The desktop app also needs a signed-in Codex CLI or Claude Code installation as described above.

Checks:

```sh
npm test
npm run build
cargo test -p am-core --lib
cargo test -p perpetual-desktop --test persistence
```

Optional checks against installed, signed-in providers (use temporary data and consume provider usage):

```sh
cargo test -p perpetual-desktop --test live_threads -- --ignored --nocapture --test-threads=1
cargo test -p am-daemon --test live_approval -- --ignored --nocapture --test-threads=1
```

Set `PERPETUAL_DATA_DIR` to run the app against a separate data folder while developing.

### Layout

- `src/`: the interface (React, TypeScript, Tailwind, Radix UI)
- `src-tauri/`: the native shell: window, IPC, provider sign-in, and shutdown
- `crates/`: the engine, database, provider adapters, Git worktrees, and protocol
- `landing/`: the website. `npm run record` in that folder re-records its product videos from the real interface with a scripted demo backend.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and report vulnerabilities as described in [SECURITY.md](SECURITY.md). Maintainers: see [RELEASING.md](RELEASING.md).

MIT licensed. Codex and Claude are trademarks of their respective owners. See [NOTICE](NOTICE).
