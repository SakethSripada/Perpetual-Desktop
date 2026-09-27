// Records the product videos on the website from the real app UI.
//
//   npm run record            record every scene
//   npm run record -- hero    record one scene
//
// Builds and serves the desktop app's interface, injects the scripted demo
// backend (demo-backend.js), drives the UI like a person would, and encodes the
// captured frames with ffmpeg. Needs Chrome and ffmpeg on PATH.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const outDir = path.resolve(here, '../public/media');
const work = path.resolve(here, '.frames');
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;
const PORT = 4318;
/** Scenes the website scrubs with scroll. */
const SCRUB = ['hero'];
// Keep in sync with the `start` the site gives each clip.
const POSTER_AT = { accounts: 1.6, approval: 2.2 };

const chrome =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A pointer drawn into the page, since headless Chrome has none.
const cursorScript = `
addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-100px,-100px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))', transition: 'scale 120ms ease' });
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
  addEventListener('mousedown', () => { c.style.scale = '0.86'; }, true);
  addEventListener('mouseup', () => { c.style.scale = '1'; }, true);
});
try { localStorage.setItem('theme', 'dark'); localStorage.setItem('composer.agent', 'codex'); } catch {}
`;

function serveApp() {
  spawnSync('npm run build', { cwd: appRoot, stdio: 'inherit', shell: true });
  return spawn(`npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`, {
    cwd: appRoot,
    shell: true,
    stdio: 'ignore',
  });
}

async function waitForServer(url, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error(`The app preview did not start at ${url}`);
}

class Recorder {
  constructor(page) {
    this.page = page;
    this.frames = [];
  }
  async start() {
    this.client = await this.page.target().createCDPSession();
    this.frames = [];
    this.t0 = null;
    this.client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      this.t0 ??= metadata.timestamp;
      this.frames.push({ data, t: metadata.timestamp - this.t0 });
      await this.client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await this.client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 96,
      maxWidth: WIDTH * SCALE,
      maxHeight: HEIGHT * SCALE,
      everyNthFrame: 1,
    });
    this.started = Date.now();
  }
  /** Seconds since recording started, for chapter marks. */
  elapsed() {
    return (Date.now() - this.started) / 1000;
  }
  async stop(name, { hold = 1.2 } = {}) {
    await sleep(hold * 1000);
    const wall = this.elapsed();
    // One more paint so the last frame's duration can be measured.
    await this.page.evaluate(() =>
      document.body.style.setProperty('--rec-tick', String(Math.random())),
    );
    await sleep(120);
    await this.client.send('Page.stopScreencast');
    const dir = path.join(work, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const list = [];
    this.frames.forEach((f, i) => {
      const file = `f${String(i).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
      const next = this.frames[i + 1]?.t ?? f.t + hold;
      list.push(`file '${file}'`, `duration ${Math.max(1 / 60, next - f.t).toFixed(4)}`);
    });
    list.push(`file 'f${String(this.frames.length - 1).padStart(5, '0')}.jpg'`);
    fs.writeFileSync(path.join(dir, 'frames.txt'), list.join('\n'));
    encode(dir, name);
    const span = this.frames.at(-1).t + hold;
    console.log(
      `${name}: ${this.frames.length} frames, ${span.toFixed(1)}s of video for ${wall.toFixed(1)}s of wall time`,
    );
  }
}

function encode(dir, name) {
  const common = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    path.join(dir, 'frames.txt'),
    '-vf',
    'fps=60,format=yuv420p',
    '-an',
  ];
  run('ffmpeg', [
    ...common,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '15',
    '-tune',
    'animation',
    '-movflags',
    '+faststart',
    path.join(outDir, `${name}.mp4`),
  ]);
  run('ffmpeg', [
    ...common,
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '28',
    '-row-mt',
    '1',
    '-deadline',
    'good',
    path.join(outDir, `${name}.webm`),
  ]);
  // The site starts some clips past their lead-in; the poster matches that frame.
  run('ffmpeg', [
    '-y',
    '-ss',
    String(POSTER_AT[name] ?? 0),
    '-i',
    path.join(outDir, `${name}.mp4`),
    '-frames:v',
    '1',
    '-q:v',
    '3',
    path.join(outDir, `${name}.jpg`),
  ]);
  // Scroll-scrubbed videos need frequent keyframes to seek smoothly. Scroll
  // sets the pace, so 30 fps at the size they're shown is enough.
  if (SCRUB.includes(name))
    run('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      path.join(dir, 'frames.txt'),
      '-vf',
      'fps=30,scale=1600:1000:flags=lanczos,format=yuv420p',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '22',
      '-g',
      '6',
      '-keyint_min',
      '6',
      '-bf',
      '0',
      '-movflags',
      '+faststart',
      path.join(outDir, `${name}-scrub.mp4`),
    ]);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.toString().slice(-800)}`);
}

// ---- Driving the UI -------------------------------------------------------

async function center(page, selector) {
  const el =
    typeof selector === 'string'
      ? await page.waitForSelector(selector, { visible: true })
      : selector;
  const box = await el.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, el };
}

let pointer = { x: WIDTH * 0.62, y: HEIGHT * 0.82 };
/** Moves the pointer along an eased path, like a hand would. */
async function moveTo(page, x, y, ms = 650) {
  const steps = Math.max(12, Math.round(ms / 16));
  const from = { ...pointer };
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  pointer = { x, y };
}

async function click(page, target, { ms = 650, pause = 180 } = {}) {
  const { x, y } = await center(page, target);
  await moveTo(page, x, y, ms);
  await sleep(pause);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
}

const byText = (page, xpath) => page.waitForSelector(`xpath/${xpath}`, { visible: true });

async function type(page, text, perChar = 34) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(perChar + (Math.random() * 30 - 12));
  }
}

async function waitForStatus(page, pattern, timeout = 60000) {
  await page.waitForFunction(
    (p) => new RegExp(p).test(document.querySelector('main .h-11')?.textContent ?? ''),
    { timeout, polling: 100 },
    pattern,
  );
}

// ---- Scenes -----------------------------------------------------------------

const scenes = {
  // A Codex task that hits a usage limit and carries on with the next account.
  async hero(page, rec, marks) {
    await sleep(900);
    await click(page, 'textarea[aria-label="Message"]');
    marks.typing = rec.elapsed();
    await type(
      page,
      'Add retries with exponential backoff to the API client, and cover them with tests.',
    );
    await sleep(350);
    await page.keyboard.press('Enter');
    marks.working = rec.elapsed();
    await moveTo(page, WIDTH * 0.95, HEIGHT * 0.55, 900);
    await page.waitForFunction(() => document.body.textContent.includes('Account limit reached'), {
      timeout: 60000,
      polling: 50,
    });
    marks.limit = rec.elapsed();
    await waitForStatus(page, 'Finished');
    marks.done = rec.elapsed();
    await sleep(700);
    await moveTo(page, WIDTH * 0.9, HEIGHT * 0.3, 900);
  },
  // Switch the same task to Claude and a newer model, then ask a follow-up.
  async claude(page, rec, marks) {
    await sleep(600);
    await click(
      page,
      await byText(
        page,
        `.//button[.//span[normalize-space()='Codex'] and ancestor::div[contains(@class,'rounded-2xl')]]`,
      ),
    );
    await sleep(350);
    await click(
      page,
      await byText(
        page,
        `.//*[@role='menuitemradio' and contains(normalize-space(), 'Claude Code')]`,
      ),
      { ms: 450 },
    );
    await sleep(450);
    await click(
      page,
      await byText(
        page,
        `.//button[.//span[normalize-space()='Claude Code'] and ancestor::div[contains(@class,'rounded-2xl')]]`,
      ),
    );
    await sleep(300);
    const model = await byText(
      page,
      `.//*[@role='menuitem' and contains(normalize-space(), 'Model')]`,
    );
    const m = await center(page, model);
    await moveTo(page, m.x, m.y, 450);
    await sleep(500);
    await click(
      page,
      await byText(page, `.//*[@role='menuitemradio' and normalize-space()='Claude Opus 5.5']`),
      { ms: 500 },
    );
    marks.switched = rec.elapsed();
    await sleep(400);
    await click(page, 'textarea[aria-label="Message"]', { ms: 500 });
    await type(page, 'Double-check the retry logic for edge cases.');
    await sleep(300);
    await page.keyboard.press('Enter');
    await moveTo(page, WIDTH * 0.95, HEIGHT * 0.55, 900);
    await waitForStatus(page, 'Finished');
    marks.done = rec.elapsed();
    await moveTo(page, WIDTH * 0.9, HEIGHT * 0.3, 900);
  },
  // Accounts at a glance: the limited account, and switching in one click.
  async accounts(page, rec, marks) {
    await sleep(500);
    await click(page, 'button[aria-label="Switch account"]');
    marks.open = rec.elapsed();
    await sleep(1800);
    await page.keyboard.press('Escape');
    await sleep(400);
    await click(
      page,
      await byText(page, `.//aside//button[contains(normalize-space(), 'Accounts')]`),
    );
    await sleep(1800);
    await moveTo(page, WIDTH * 0.62, HEIGHT * 0.52, 900);
    await sleep(1400);
  },
  // An agent asks before running a command.
  async approval(page, rec, marks) {
    await page.evaluate(() => (window.__demo.next = 'approval'));
    await click(page, await byText(page, `.//aside//*[normalize-space()='New task']`));
    await sleep(500);
    await click(page, 'textarea[aria-label="Message"]');
    await type(page, 'Add a 10 second timeout to every request.');
    await page.keyboard.press('Enter');
    await moveTo(page, WIDTH * 0.95, HEIGHT * 0.55, 900);
    await page.waitForSelector('xpath/.//button[normalize-space()="Allow"]', {
      visible: true,
      timeout: 30000,
    });
    marks.asked = rec.elapsed();
    await sleep(1400);
    await click(page, await byText(page, `.//button[normalize-space()='Allow']`), {
      ms: 800,
      pause: 350,
    });
    await waitForStatus(page, 'Finished');
    marks.done = rec.elapsed();
  },
};

// ---- Main ------------------------------------------------------------------

const wanted = process.argv.slice(2);
const order = ['hero', 'claude', 'accounts', 'approval'];
if (!chrome) throw new Error('Chrome not found; set CHROME_PATH.');
fs.mkdirSync(outDir, { recursive: true });
const server = serveApp();
await waitForServer(`http://127.0.0.1:${PORT}/`);
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  // Without this, headless screencasts arrive at 1x even with a 2x viewport.
  args: [
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--disable-lcd-text',
    `--force-device-scale-factor=${SCALE}`,
  ],
});
const chapters = fs.existsSync(path.join(outDir, 'chapters.json'))
  ? JSON.parse(fs.readFileSync(path.join(outDir, 'chapters.json'), 'utf8'))
  : {};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
    { name: 'prefers-reduced-motion', value: 'no-preference' },
  ]);
  await page.evaluateOnNewDocument(fs.readFileSync(path.join(here, 'demo-backend.js'), 'utf8'));
  await page.evaluateOnNewDocument(cursorScript);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('textarea[aria-label="Message"]');
  await sleep(800);
  const rec = new Recorder(page);
  // Scenes build on each other (the Claude follow-up continues the hero task),
  // so earlier scenes always run; only requested ones are kept.
  for (const name of order) {
    const keep = !wanted.length || wanted.includes(name);
    const marks = {};
    if (keep) await rec.start();
    else rec.started = Date.now();
    await scenes[name](page, rec, marks);
    if (keep) {
      await rec.stop(name);
      chapters[name] = Object.fromEntries(
        Object.entries(marks).map(([k, v]) => [k, +v.toFixed(2)]),
      );
    }
    if (wanted.length && order.slice(order.indexOf(name) + 1).every((n) => !wanted.includes(n)))
      break;
  }
} finally {
  await browser.close();
  server.kill();
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
}
fs.writeFileSync(path.join(outDir, 'chapters.json'), JSON.stringify(chapters, null, 2) + '\n');
console.log('Chapters:', chapters);
