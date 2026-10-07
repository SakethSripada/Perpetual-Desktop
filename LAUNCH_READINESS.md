# Launch readiness review — October 7, 2026

Decision: hold paid advertising until a release containing these fixes passes the installer and sign-in checks below. The development checks pass; they do not certify the currently published installers.

## Fixes

- A failed provider login check no longer treats an old credentials file as a signed-in account. Claude login status is parsed as JSON, including formatted output.
- Account login probes have a ten-second timeout and terminate their child process on cancellation. Probe caches distinguish app data folders and providers.
- Accounts whose CLI is missing cannot become active or receive a run.
- Resuming after a usage limit respects both automatic switching and the earliest-reset preference. When waiting for the original account, the launch also uses that account rather than another account of the same provider.
- Rapid settings changes preserve every change and serialize writes. A background refresh cannot replace pending settings with an older snapshot.
- Duplicate composer submissions are prevented, and sending a message preserves a draft entered while the send is pending.
- Repeated Enter submissions cannot create duplicate accounts or overlap setup-token saves while a request is pending.
- Updated vulnerable npm development dependencies in both packages. Added the landing site's direct Node type dependency and documented the supported Node versions.
- Updated event-listener to 5.4.2, chacha20 to 0.10.2, and spin to 0.9.9 in the Rust lockfile.

## Verification

- Frontend: 31 tests pass, including rapid settings changes, slow writes with concurrent refresh, duplicate sends, draft preservation, and duplicate account/token form submissions. TypeScript and production Vite build pass.
- Rust: 299 automated tests pass across the workspace. Coverage includes message queue races, provider limits and account selection, disconnect handling, budgets, persistence, migrations, managed worktrees, binary patches, and conflict handling.
- Live providers: all four existing approval tests pass against real Codex and Claude Code. Two new desktop thread RPC smoke tests pass, covering replies, a second turn in the same conversation, and persisted history after restarting the core. They use temporary application data and no real project files.
- Live Codex model discovery also passes against the installed CLI.
- Formatting and diff whitespace checks pass. The landing site builds successfully. Both npm dependency audits report zero known vulnerabilities.
- Windows production compilation and NSIS packaging succeeded. The final debug desktop rerun was blocked by Windows locking the running development executable; backend checks were rerun separately and release-mode persistence validation passed instead.
- Rust dependency audit: the fixable event-listener issue and yanked dependencies were updated. RUSTSEC-2023-0071 remains in the lockfile for optional RSA dependencies; `cargo tree -i rsa` and `cargo tree -i rsa --target all` show no active path. Unmaintained Unicode crates are used by Tauri's URL-pattern dependency; the GLib unsoundness and proc-macro-error maintenance warnings concern the unsupported Linux GUI stack. This is not a clean all-lockfile Rust audit.
- The pinned public v0.1.0 installer hashes match both the GitHub asset digests and the published SHA256SUMS.txt. Those downloads do not contain this review's new fixes.
- Native UI accessibility inspection confirmed the app loads and displays its composer and existing accounts. Screen capture and native click automation failed in this environment; a full visual/native interaction pass is still required.

## Release gates still required

1. Build and publish a new release from the tested code. The latest public release observed during this review was v0.1.0, published September 29, 2026. `landing/src/lib/site.ts` hardcodes that release's URLs and hashes, so update those together with the release, or restore the manifest-based download flow.
2. Install the exact release artifact on a clean Windows account and on both supported macOS architectures. Verify launch, CLI discovery, installer/uninstaller behavior, and the expected signing or unsigned-install experience.
3. Complete fresh browser sign-in for each provider, then test an additional isolated account and a Claude setup-token account. Verify cancel/failure/retry, returning from the browser, selection of the intended account, and credential persistence after app restart.
4. Exercise real account exhaustion and recovery with multiple accounts, including cross-provider continuation and switch-back. Automated tests exercise these decisions, but this review did not deliberately exhaust subscriptions or wait for a live reset.
5. Follow the visual/theme/window and project-edit/apply checklist in RELEASING.md on the packaged apps. macOS runtime behavior was not tested on this Windows host.

The optional live checks are documented in README.md and can be repeated for a release candidate. They require signed-in providers and consume provider usage. They fail when a provider is unavailable rather than silently passing a skipped smoke check.
