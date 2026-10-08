import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { REPO, detectPlatform, type Platform } from '../lib/site';

const SOURCE_COMMAND = `git clone --branch dev ${REPO}.git
cd Perpetual-Desktop
npm start`;
type DownloadFlow = {
  platform: Platform;
  showInstructions: (platform?: Platform) => void;
};
const DownloadContext = createContext<DownloadFlow | null>(null);

export function useDownloadFlow(): DownloadFlow {
  const flow = useContext(DownloadContext);
  if (!flow) throw new Error('DownloadFlow is missing its provider');
  return flow;
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [platform] = useState<Platform>(detectPlatform);
  const [instructionsFor, setInstructionsFor] = useState<Platform | null>(null);
  return (
    <DownloadContext.Provider
      value={{ platform, showInstructions: (selected = platform) => setInstructionsFor(selected) }}
    >
      {children}
      {instructionsFor !== null && (
        <SourceDialog platform={instructionsFor} onClose={() => setInstructionsFor(null)} />
      )}
    </DownloadContext.Provider>
  );
}

function SourceDialog({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(SOURCE_COMMAND);
      setCopyStatus('Setup commands copied to clipboard.');
    } catch {
      setCopyStatus('Select and copy the commands below.');
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="source-dialog-title"
      className="m-auto max-h-[88dvh] w-[min(92vw,580px)] overflow-y-auto rounded-2xl border border-line-strong bg-card p-0 text-ink shadow-[0_30px_100px_rgba(0,0,0,0.75)] backdrop:bg-black/75"
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-muted">Run from source</p>
            <h2
              id="source-dialog-title"
              className="mt-2 text-[24px] font-semibold tracking-tight text-sage"
            >
              Get Perpetual running
            </h2>
            <p className="mt-1.5 text-[14px] leading-6 text-muted">
              Installer downloads are temporarily paused while we prepare signed releases.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close setup instructions"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[23px] leading-none text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="mt-6 text-[14px] leading-6 text-muted">
          <p>
            Install{' '}
            <a className="text-ink underline" href="https://git-scm.com/downloads">
              Git
            </a>{' '}
            and{' '}
            <a className="text-ink underline" href="https://nodejs.org/">
              Node.js 24 LTS
            </a>
            , then open{' '}
            {platform === 'windows'
              ? 'PowerShell'
              : platform === 'mac'
                ? 'Terminal'
                : 'PowerShell on Windows or Terminal on macOS'}{' '}
            and run:
          </p>
          <div className="mt-3 rounded-xl border border-line bg-black/30 p-4">
            <pre className="overflow-x-auto text-[12px] leading-6 text-ink">
              <code>{SOURCE_COMMAND}</code>
            </pre>
            <button
              type="button"
              onClick={() => void copyCommand()}
              aria-label="Copy setup commands"
              className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-white/10"
            >
              {copyStatus.startsWith('Setup') ? 'Copied' : 'Copy commands'}
            </button>
            <p role="status" className="mt-2 text-[12px]">
              {copyStatus}
            </p>
          </div>
          <p className="mt-4">
            Setup installs the build dependencies and opens the desktop app. Accept any system
            installation prompts. The first build can take several minutes; keep this terminal open
            while using Perpetual.
          </p>
          <p className="mt-4">
            Setup installs Codex CLI if neither coding agent is available. You can also use{' '}
            <a className="text-ink underline" href="https://developers.openai.com/codex/cli">
              Codex CLI
            </a>{' '}
            or{' '}
            <a
              className="text-ink underline"
              href="https://docs.anthropic.com/en/docs/claude-code/setup"
            >
              Claude Code
            </a>{' '}
            and sign in from Perpetual. Existing CLI sign-ins are detected automatically.
          </p>
          <p className="mt-4">
            Next time, run <code className="text-ink">npm start</code> in the same folder.{' '}
            <a
              className="text-ink underline underline-offset-4"
              href={`${REPO}/blob/dev/README.md#build-from-source`}
            >
              Setup guide and troubleshooting
            </a>
          </p>
        </div>
      </div>
    </dialog>
  );
}
