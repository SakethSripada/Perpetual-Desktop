# Perpetual

A Windows desktop workspace for long-running Codex and Claude Code tasks. Perpetual keeps a task's conversation, workspace, and queued messages together, and when an account reaches its usage limit it continues on your next account.

## Install

Download the latest installer from [Releases](https://github.com/SakethSripada/Perpetual-Desktop/releases) and run it. It installs for your Windows account only and doesn't need administrator rights.

You also need at least one of:

- [Codex CLI](https://developers.openai.com/codex/cli)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup)

If the CLI is already signed in, Perpetual picks up that account automatically.

### Verify your download

Each release lists the SHA-256 hash of its installer in `SHA256SUMS.txt`. To check your copy:

```powershell
Get-FileHash .\Perpetual_0.1.0_x64-setup.exe -Algorithm SHA256
```

Release builds are made by GitHub Actions from this repository. You can confirm that with the [GitHub CLI](https://cli.github.com/):

```sh
gh attestation verify Perpetual_0.1.0_x64-setup.exe --repo SakethSripada/Perpetual-Desktop
```

## Accounts

- **Several accounts per provider.** Each account you add signs in separately, in its own profile.
- **Switch any time.** Pick the account to use from the sidebar, the composer, or **Accounts**. The next message uses it.
- **Automatic switching.** When an account reaches its usage limit, the task continues on the next ready account in your switching order. If every account is limited, it resumes when the first one resets.

Sign-ins stay on your computer. Setup tokens are stored in Windows Credential Manager, not in Perpetual's database.

## Build from source

Requirements: Windows 10 or later, Node.js 22+, Rust 1.96.1 (installed automatically by `rust-toolchain.toml` with rustup), and Visual Studio Build Tools with the **Desktop development with C++** workload.

```sh
npm ci
npm run desktop    # run with hot reload
npm run bundle     # build the installer into target/release/bundle/nsis/
```

`npm run dev` opens a browser preview of the interface without the engine.

Checks:

```sh
npm test
npm run build
cargo test -p am-core --lib
cargo test -p perpetual-desktop --test persistence
```

Set `PERPETUAL_DATA_DIR` to run the app against a separate data folder while developing.

### Layout

- `src/`: the interface (React, TypeScript, Tailwind, Radix UI)
- `src-tauri/`: the native shell: window, IPC, provider sign-in, and shutdown
- `crates/`: the engine, database, provider adapters, Git worktrees, and protocol

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and report vulnerabilities as described in [SECURITY.md](SECURITY.md). Maintainers: see [RELEASING.md](RELEASING.md).

MIT licensed. Codex and Claude are trademarks of their respective owners. See [NOTICE](NOTICE).
