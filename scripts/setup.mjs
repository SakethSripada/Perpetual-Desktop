import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function supportedNode(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return (major === 22 && minor >= 13) || major === 24 || major >= 26;
}

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
function probe(command, args = []) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${signal ?? code}).`)),
    );
  });
}
function npm(args) {
  // npm exposes its JS entrypoint even on Windows; no shell quoting is needed.
  if (!process.env.npm_execpath)
    throw new Error('Run this through npm: npm run setup, npm run doctor, or npm start.');
  return run(process.execPath, [process.env.npm_execpath, ...args]);
}

export async function setup({ check = false, launch = false } = {}) {
  const missing = [];
  if (!supportedNode(process.version))
    missing.push('Install Node.js 22.13+ (22.x), 24.x, or 26+: https://nodejs.org/');
  if (!['win32', 'darwin'].includes(process.platform))
    missing.push('The desktop app supports Windows and macOS.');
  if (probe('git', ['--version']).status !== 0)
    missing.push('Install Git: https://git-scm.com/downloads');
  if (probe('rustup', ['--version']).status !== 0)
    missing.push('Install rustup: https://rustup.rs/');
  if (windows) {
    const vswhere = path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)',
      'Microsoft Visual Studio/Installer/vswhere.exe',
    );
    const vs = probe(vswhere, [
      '-latest',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ]);
    if (vs.status !== 0 || !vs.stdout?.trim())
      missing.push(
        'Install Visual Studio Build Tools with Desktop development with C++ (including a Windows SDK): https://visualstudio.microsoft.com/visual-cpp-build-tools/',
      );
  } else if (process.platform === 'darwin' && probe('xcode-select', ['-p']).status !== 0) {
    missing.push('Install Apple command-line tools: xcode-select --install');
  }
  if (missing.length)
    throw new Error(
      `Setup needs these prerequisites:\n\n${missing.map((item) => `- ${item}`).join('\n')}\n\nRestart your terminal after installing them, then run npm start again.`,
    );
  const toolchain = readFileSync(path.join(root, 'rust-toolchain.toml'), 'utf8').match(
    /channel\s*=\s*"([^"]+)"/,
  )?.[1];
  if (!toolchain) throw new Error('Cannot read the pinned Rust toolchain.');
  if (check) {
    const rust = probe('rustup', ['run', toolchain, 'rustc', '--version']);
    if (rust.status !== 0)
      throw new Error(
        `Rust ${toolchain} is missing. Run npm run setup to install it automatically.`,
      );
    if (!existsSync(path.join(root, 'node_modules/@tauri-apps/cli/package.json')))
      throw new Error('JavaScript dependencies are missing. Run npm run setup.');
    console.log('Build prerequisites and dependencies are available.');
  } else {
    await run('rustup', [
      'toolchain',
      'install',
      toolchain,
      '--profile',
      'minimal',
      '--no-self-update',
    ]);
    await npm(['ci']);
    console.log(
      'Source setup complete. Run npm run desktop to open Perpetual, or npm run bundle to build an installer.',
    );
  }
  console.log(
    'To run tasks, install Codex CLI or Claude Code and sign in from the app. Existing signed-in CLI accounts are detected automatically.',
  );
  if (launch) await npm(['run', 'desktop']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup({
    check: process.argv.includes('--check'),
    launch: process.argv.includes('--launch'),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
