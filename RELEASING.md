# Releasing Perpetual

## Cut a release

1. Set the same version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, and run `npm install` so `package-lock.json` follows.
2. Commit, then tag and push:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The **Release** workflow builds the Windows installer and a universal macOS app, signs them (when signing is configured), checks the signatures, writes `SHA256SUMS.txt`, records a build provenance attestation, and opens a **draft** GitHub release.
4. Download the installer from the draft, install it on a clean Windows account, and run through the checklist below. Then publish the draft.

To rebuild an existing tag, run the workflow manually and enter the tag.

## Code signing

Signing is what stops Windows from warning people about an unknown publisher. SHA-256 checksums let people confirm a download wasn't altered, but they don't affect SmartScreen or antivirus reputation. A signature does.

The workflow signs with [Azure Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/). One-time setup:

1. Create a Trusted Signing account and a **Public Trust** certificate profile in Azure, and complete identity validation. Check Microsoft's current eligibility rules for individuals and organizations first.
2. Create an app registration (service principal) and give it the **Trusted Signing Certificate Profile Signer** role on the account.
3. In the GitHub repository settings, add:
   - Secrets: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
   - Variables: `AZURE_SIGNING_ENDPOINT` (for example `https://eus.codesigning.azure.net`), `AZURE_SIGNING_ACCOUNT`, `AZURE_SIGNING_PROFILE`

Without these, releases are built unsigned, and the release notes say so.

Even signed, a brand-new publisher can still see SmartScreen prompts until the certificate builds reputation through downloads. Keep signing every release with the same identity.

### macOS

macOS won't open downloaded apps that aren't signed with a Developer ID and notarized by Apple without extra steps from the user. You need an [Apple Developer Program](https://developer.apple.com/programs/) membership. Then add these repository secrets:

- `APPLE_CERTIFICATE`: your **Developer ID Application** certificate exported as a `.p12` and base64-encoded
- `APPLE_CERTIFICATE_PASSWORD`: the `.p12` password
- `APPLE_SIGNING_IDENTITY`: for example `Developer ID Application: Your Name (TEAMID)`
- `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), and `APPLE_TEAM_ID` for notarization

Without them, the macOS app is only ad-hoc signed; people have to right-click it and choose **Open** the first time.

## If antivirus flags a build

False positives happen to new, unsigned, or rarely downloaded executables. If one is reported:

- Submit the file to Microsoft at <https://www.microsoft.com/wdsi/filesubmission> as a software developer, and to the reporting vendor's false-positive form.
- Include the release URL and the SHA-256 hash from `SHA256SUMS.txt`.

What the app already avoids, so it doesn't look like malware:

- It installs per user under `%LOCALAPPDATA%` and never asks for administrator rights.
- Background helpers (git and the provider CLIs) run without flashing console windows. The only visible terminal is the one opened for a provider sign-in, when the user asks for it.
- It doesn't use packers, obfuscation, or PowerShell execution-policy bypasses.
- The webview may only open `https://` links in the browser and pick folders; all other native access goes through the app's own commands.
- The binary carries full version information: product name, publisher, version, and copyright.

## Release checklist

- [ ] The Windows installer runs without administrator rights, and the Start menu shortcut launches the app.
- [ ] On macOS, the app opens from Applications without a warning, and its window controls sit in the title bar.
- [ ] On first launch, a signed-in Codex or Claude CLI appears in Accounts with its email.
- [ ] A task runs on Codex and on Claude, and the reply streams in.
- [ ] Choosing **Use** on another account moves the active account, and the next message uses it.
- [ ] Changes from a task with a project appear in **Changes** and apply to the project.
- [ ] Light, dark, and system themes all read well. The window restores its last size and position.
- [ ] Uninstalling from **Settings → Apps** (Windows) or moving the app to the Trash (macOS) removes it.
