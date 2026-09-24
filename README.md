# Perpetual Desktop

A native Windows workspace for persistent Codex and Claude Code tasks. Built with Tauri 2, Rust, React, TypeScript, Tailwind 4, and Radix UI.

> [!IMPORTANT]
> Perpetual Desktop is early-stage software. Back up important work and review agent-generated changes before applying them.

## Requirements

- Windows 10 or later with WebView2
- Node.js 22 or later
- Rust 1.96.1 (installed automatically by `rust-toolchain.toml` when using rustup)
- Visual Studio Build Tools with the Desktop development with C++ workload
- The Codex and/or Claude Code CLI

## Run

```sh
npm ci
npm run desktop
```

`npm run dev` opens a UI-only browser preview; accounts and task execution require the desktop app.

## Build and check

```sh
npm test
npm run build
cargo test -p perpetual-desktop --test persistence
npm run bundle
```

The Windows installer is written to `target/release/bundle/nsis/`.

## Features

- Persistent sessions, streaming transcripts, queued follow-ups, structured questions, and approvals.
- Isolated Codex and Claude account profiles, ordered account rotation, rate-limit fallback, earliest-reset recovery, and switchback.
- Provider model/reasoning profiles, task budgets, local model fallback, and Docker Sandbox settings.
- Local and GitHub repositories, managed worktrees, diff review, and explicit application of changes.
- Plans, activity history, slash commands, dark/light appearance, and keyboard shortcuts.
- Cloud continuity configuration and native power lifecycle integration. Cloud runs require provider support and configuration.

The desktop owns a separate database under the OS application-data directory (`dev.perpetual.desktop`), preventing scheduler conflicts with the extension. Existing extension sessions and credentials are not automatically imported. Connect accounts in **Accounts**.

Provider credentials are handled locally and are not committed to the repository. Never include tokens, account data, or generated application data in bug reports.

## Source

`src/` contains the desktop interface. `src-tauri/` owns the native window, safe IPC, sign-in launch, and shutdown lifecycle. `crates/` contains Perpetual's existing Rust engine, database, provider adapters, VCS support, and protocol. The desktop dispatches through the same engine API used by the extension; it does not emulate account switching in the UI.

The extension's disabled LAN collaboration backend is retained in `crates/`; the desktop does not yet expose LAN pairing. Interactive CLI sign-in and installer packaging currently target Windows.

MIT licensed. Provider trademarks belong to their owners. See [NOTICE](NOTICE) for component and asset attribution.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities according to [SECURITY.md](SECURITY.md).

## Standalone executable

To build a development executable without an installer:

```sh
npm run build
cargo build -p perpetual-desktop --features custom-protocol
```

Open `target/debug/perpetual-desktop.exe`. This executable embeds the frontend and does not need a dev server.
