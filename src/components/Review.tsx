import { useEffect, useMemo, useState } from 'react';
import { X, GitCompare, ChevronRight, RefreshCw, GitBranch, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { action, rpc } from '../lib/api';
import { errorMessage } from '../lib/format';
import type { AgentThread, AgentThreadDiff, AgentThreadApplyResult } from '../lib/types';
import { Button, Confirm, Empty, IconButton, cn } from './ui';

/** Splits a unified diff into one chunk per file, keyed by the new path. */
function splitPatch(patch: string) {
  const files = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of patch.split('\n')) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      current = [];
      files.set(header[2], current);
      continue;
    }
    if (
      current &&
      !/^(index |--- |\+\+\+ |new file mode|deleted file mode|similarity |rename )/.test(line)
    )
      current.push(line);
  }
  return files;
}

export function Review({ thread, onClose }: { thread: AgentThread; onClose: () => void }) {
  const [diff, setDiff] = useState<AgentThreadDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<AgentThreadApplyResult | null>(null);
  const [applied, setApplied] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      setDiff(await rpc<AgentThreadDiff>('thread_diff', { thread_id: thread.id }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [thread.id, thread.status]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const repos = diff?.repos.filter((r) => r.files.length) ?? [];
  const totals = repos.reduce(
    (sum, r) => {
      for (const f of r.files) {
        sum.files += 1;
        sum.add += f.additions;
        sum.del += f.deletions;
      }
      return sum;
    },
    { files: 0, add: 0, del: 0 },
  );
  return (
    <>
      <div className="fixed inset-0 z-20 bg-black/30 min-[1180px]:hidden" onClick={onClose} />
      <aside className="fixed top-12 right-0 bottom-0 z-30 flex w-[min(560px,92vw)] animate-fade-in flex-col border-l border-line bg-surface shadow-2xl min-[1180px]:static min-[1180px]:z-auto min-[1180px]:w-[44%] min-[1180px]:max-w-[640px] min-[1180px]:min-w-[380px] min-[1180px]:shadow-none">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line/60 pr-2 pl-4 text-[13px]">
          <GitCompare size={14} className="text-muted" />
          <span className="font-medium">Changes</span>
          {totals.files > 0 && (
            <span className="text-xs text-muted">
              {totals.files} {totals.files === 1 ? 'file' : 'files'} ·{' '}
              <span className="text-success">+{totals.add}</span>{' '}
              <span className="text-danger">−{totals.del}</span>
            </span>
          )}
          <span className="flex-1" />
          <IconButton label="Refresh" onClick={() => void refresh()}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </IconButton>
          <IconButton label="Close (Esc)" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <Empty title="Couldn't load changes">{error}</Empty>
          ) : !diff ? (
            <Empty title="Loading changes…" />
          ) : !repos.length ? (
            <Empty
              icon={<GitCompare size={22} />}
              title={applied ? 'All changes applied' : 'No changes yet'}
            >
              {applied
                ? 'They are in your project folder now, ready for you to commit.'
                : "Edits the agent makes in this task's workspace show up here for review before they reach your project."}
            </Empty>
          ) : (
            repos.map((repo) => (
              <RepoDiff key={repo.repo_id} repo={repo} showName={repos.length > 1} />
            ))
          )}
          {result && !result.applied && (
            <div className="m-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs leading-5">
              <div className="mb-1 font-medium text-danger">Couldn't apply the changes</div>
              {[...result.blockers, ...result.repos.map((r) => r.blocker).filter(Boolean)].map(
                (b) => (
                  <div key={b} className="text-muted">
                    {b}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
        {repos.length > 0 && (
          <footer className="flex items-center gap-2 border-t border-line/60 px-4 py-3">
            <p className="min-w-0 flex-1 text-xs leading-5 text-muted">
              Changes stay in the task's workspace until you apply them.
            </p>
            <Button variant="primary" onClick={() => setConfirm(true)}>
              Apply to project
            </Button>
          </footer>
        )}
      </aside>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Apply these changes?"
        description="They'll be copied into your project folder. If you've edited the same files there, nothing is changed and you'll see which files conflict."
        confirmLabel="Apply changes"
        icon={<GitMerge size={16} />}
        onConfirm={() =>
          action(async () => {
            const outcome = await rpc<AgentThreadApplyResult>('apply_thread_changes', {
              thread_id: thread.id,
            });
            setResult(outcome);
            if (outcome.applied) {
              setApplied(true);
              toast.success('Changes applied to your project');
              await refresh();
            }
            return outcome.applied;
          }).then((ok) => {
            if (ok) setResult(null);
          })
        }
      />
    </>
  );
}

function RepoDiff({
  repo,
  showName,
}: {
  repo: AgentThreadDiff['repos'][number];
  showName: boolean;
}) {
  const chunks = useMemo(() => splitPatch(repo.patch), [repo.patch]);
  return (
    <section className="border-b border-line/60 last:border-0">
      {(showName || repo.branch) && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-muted">
          {showName && <span className="font-medium text-ink">{repo.repo_name}</span>}
          {repo.branch && (
            <span className="flex items-center gap-1 truncate text-faint">
              <GitBranch size={11} />
              {repo.branch}
            </span>
          )}
        </div>
      )}
      {repo.files.map((file) => (
        <FileDiff
          key={file.path}
          path={file.path}
          status={file.status}
          add={file.additions}
          del={file.deletions}
          lines={chunks.get(file.path)}
        />
      ))}
    </section>
  );
}

function FileDiff({
  path,
  status,
  add,
  del,
  lines,
}: {
  path: string;
  status: string;
  add: number;
  del: number;
  lines?: string[];
}) {
  const [open, setOpen] = useState(true);
  const slash = path.lastIndexOf('/');
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="sticky top-0 z-10 flex w-full items-center gap-2 bg-surface px-4 py-2 text-left text-xs hover:bg-hover"
      >
        <ChevronRight
          size={13}
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-90')}
        />
        <span className="min-w-0 truncate font-mono">
          <span className="text-faint">{slash >= 0 ? path.slice(0, slash + 1) : ''}</span>
          {path.slice(slash + 1)}
        </span>
        {/^(a|added|new)/i.test(status) && <span className="text-[10px] text-success">new</span>}
        {/^(d|deleted)/i.test(status) && <span className="text-[10px] text-danger">deleted</span>}
        <span className="ml-auto shrink-0 tabular-nums">
          <span className="text-success">+{add}</span> <span className="text-danger">−{del}</span>
        </span>
      </button>
      {open && lines && lines.length > 0 && (
        <pre className="overflow-x-auto pb-2 font-mono text-[11.5px] leading-5 selectable">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'px-4 whitespace-pre',
                line.startsWith('+') && 'bg-success/10 text-success',
                line.startsWith('-') && 'bg-danger/10 text-danger',
                line.startsWith('@@') && 'pt-2 text-faint',
              )}
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
