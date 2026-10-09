# Contributing

Thanks for helping improve Perpetual Desktop.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Use an issue to discuss large features or architectural changes first.
- Never include credentials, private prompts, repository contents, or application data in an issue.

## Development setup

Install the prerequisites listed in the README, then run:

```sh
npm start
```

The frontend is in `src/`, the Tauri shell is in `src-tauri/`, and the Rust workspace is in `crates/`.

## Checks

Run the checks relevant to your change before submitting it:

```sh
npm run format:check
npm test
npm run build
cargo fmt --all -- --check
cargo test --workspace --locked
cargo check -p perpetual-desktop --locked
```

Keep pull requests focused, explain user-visible behavior, and include tests for behavior changes when practical.

## Pull requests

- Use a clear title and describe why the change is needed.
- Link related issues.
- Call out platform-specific behavior and any checks you could not run.
- Confirm that your contribution can be distributed under the MIT License.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
