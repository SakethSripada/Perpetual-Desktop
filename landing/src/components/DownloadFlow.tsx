import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DIRECT_RELEASE, REPO, detectPlatform, type Platform } from '../lib/site';
import { AppleLogo, WindowsLogo } from './Mark';

export type DownloadPlatform = Exclude<Platform, 'other'>;

type DownloadFlow = {
  platform: Platform;
  showInstructions: (platform: DownloadPlatform) => void;
};

const DownloadContext = createContext<DownloadFlow | null>(null);
const CLONE_COMMAND = `git clone ${REPO}.git`;

export function useDownloadFlow(): DownloadFlow {
  const flow = useContext(DownloadContext);
  if (!flow) throw new Error('DownloadFlow is missing its provider');
  return flow;
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [platform] = useState<Platform>(detectPlatform);
  const [instructionsFor, setInstructionsFor] = useState<DownloadPlatform | null>(null);

  return (
    <DownloadContext.Provider value={{ platform, showInstructions: setInstructionsFor }}>
      {children}
      {instructionsFor && (
        <InstallDialog platform={instructionsFor} onClose={() => setInstructionsFor(null)} />
      )}
    </DownloadContext.Provider>
  );
}

function InstallDialog({ platform, onClose }: { platform: DownloadPlatform; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const asset = DIRECT_RELEASE[platform];
  const isWindows = platform === 'windows';

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function copyCloneCommand() {
    try {
      await navigator.clipboard.writeText(CLONE_COMMAND);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="install-dialog-title"
      className="m-auto max-h-[88dvh] w-[min(92vw,640px)] overflow-y-auto rounded-3xl border border-line-strong bg-card p-0 text-ink shadow-[0_30px_100px_rgba(0,0,0,0.75)] backdrop:bg-black/75"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-medium text-sage">
              {isWindows ? <WindowsLogo size={15} /> : <AppleLogo size={15} />}
              {isWindows ? 'Windows x64' : 'macOS universal'}
            </p>
            <h2 id="install-dialog-title" className="mt-2 text-[28px] font-semibold tracking-tight">
              Your download is starting
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-muted">
              If it does not start,{' '}
              <a className="text-ink underline underline-offset-4" href={asset.url}>
                download {asset.name} from GitHub
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close installation instructions"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[23px] leading-none text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-5 text-[14px] leading-6 text-muted">
          <section>
            <h3 className="font-medium text-ink">1. Verify the download</h3>
            <p className="mt-2">
              In the folder where you saved the file, run this command and compare the result with{' '}
              <a className="text-ink underline underline-offset-4" href={DIRECT_RELEASE.checksums}>
                SHA256SUMS.txt
              </a>
              :
            </p>
            <code className="mt-2 block overflow-x-auto rounded-xl bg-black/30 p-3 text-[12px] text-ink">
              {isWindows
                ? `Get-FileHash .\\${asset.name} -Algorithm SHA256`
                : `shasum -a 256 ${asset.name}`}
            </code>
            <p className="mt-2 text-[12px]">Expected SHA-256:</p>
            <code className="block break-all text-[12px] text-ink">{asset.sha256}</code>
          </section>

          <section>
            <h3 className="font-medium text-ink">2. Open Perpetual</h3>
            {isWindows ? (
              <p className="mt-2">
                Run the installer. If SmartScreen says “Windows protected your PC,” choose{' '}
                <strong className="font-medium text-ink">More info</strong> →{' '}
                <strong className="font-medium text-ink">Run anyway</strong> only if the source and
                checksum match and you trust this release. Some managed PCs and Smart App Control
                settings do not allow unsigned apps; do not turn off system protection.
              </p>
            ) : (
              <p className="mt-2">
                Open the DMG and drag Perpetual to Applications. If macOS blocks its first launch,
                try opening it once, then go to{' '}
                <strong className="font-medium text-ink">
                  System Settings → Privacy &amp; Security → Open Anyway
                </strong>{' '}
                after verifying the download.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white/[0.035] p-4">
            <h3 className="font-medium text-ink">You can also run it from source</h3>
            <p className="mt-1">
              Clone the public repository, then follow the{' '}
              <a
                className="text-ink underline underline-offset-4"
                href={`${REPO}#build-from-source`}
              >
                README setup steps
              </a>
              .
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-black/30 px-3 py-2 text-[12px] text-ink">
                {CLONE_COMMAND}
              </code>
              <button
                type="button"
                onClick={() => void copyCloneCommand()}
                className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-bg transition-colors hover:bg-white"
              >
                {copied ? 'Copied' : 'Copy command'}
              </button>
            </div>
            <span className="sr-only" aria-live="polite">
              {copied ? 'Clone command copied to clipboard' : ''}
            </span>
          </section>
        </div>
      </div>
    </dialog>
  );
}
