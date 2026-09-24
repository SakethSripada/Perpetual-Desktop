import { useEffect, useState } from 'react';
import { X, GitBranch, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import { action, rpc } from '../lib/api';
import type { AgentThread, AgentThreadDiff, AgentThreadApplyResult } from '../lib/types';
import { Button, Empty, Modal, cn } from './ui';
export function Review({ thread, onClose }: { thread: AgentThread; onClose: () => void }) {
  const [diff, setDiff] = useState<AgentThreadDiff | null>(null);
  const [confirm, setConfirm] = useState(false);
  const refresh = () =>
    action(async () =>
      setDiff(await rpc<AgentThreadDiff>('thread_diff', { thread_id: thread.id })),
    );
  useEffect(() => {
    void refresh();
  }, [thread.id]);
  return (
    <aside className="flex w-[40%] min-w-[340px] flex-col border-l border-line">
      <header className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm">
        <GitBranch size={15} />
        Changes
        <Button className="ml-auto" onClick={onClose} aria-label="Close review">
          <X size={16} />
        </Button>
      </header>
      <div className="flex-1 overflow-auto p-5">
        {diff?.repos.some((r) => r.files.length) ? (
          diff.repos.map((repo) => (
            <section key={repo.repo_id} className="mb-6">
              <h3 className="mb-3 text-sm font-medium">
                {repo.repo_name}
                <span className="ml-2 text-xs text-muted">{repo.branch}</span>
              </h3>
              {repo.files.map((file) => (
                <div key={file.path} className="flex items-center gap-2 py-2 text-xs">
                  <FileCode2 size={13} />
                  <span className="truncate">{file.path}</span>
                  <span className="ml-auto text-emerald-400">+{file.additions}</span>
                  <span className="text-red-400">−{file.deletions}</span>
                </div>
              ))}
              <pre className="mt-4 overflow-auto rounded-lg bg-sidebar p-3 font-mono text-[11px] leading-5">
                {repo.patch.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      line.startsWith('+') && 'bg-emerald-500/5 text-emerald-300',
                      line.startsWith('-') && 'bg-red-500/5 text-red-300',
                      line.startsWith('@@') && 'text-sky-300',
                    )}
                  >
                    {line || ' '}
                  </div>
                ))}
              </pre>
            </section>
          ))
        ) : (
          <Empty
            icon={<GitBranch size={24} />}
            title={diff ? 'No changes yet' : 'Loading changes…'}
          >
            Changes from the managed workspace appear here.
          </Empty>
        )}
      </div>
      <footer className="flex gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
        <Button
          variant="solid"
          disabled={!diff?.repos.some((r) => r.files.length)}
          onClick={() => setConfirm(true)}
        >
          Apply to repository
        </Button>
      </footer>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Apply reviewed changes?"
        description="Copy these changes from the managed worktree into your local repository. Conflicting local edits will block the operation."
      >
        <Button
          variant="solid"
          onClick={() =>
            void action(async () => {
              const result = await rpc<AgentThreadApplyResult>('apply_thread_changes', {
                thread_id: thread.id,
              });
              if (!result.applied) throw new Error(result.blockers.join('\n'));
              toast.success('Changes applied');
              setConfirm(false);
              await refresh();
            })
          }
        >
          Apply changes
        </Button>
      </Modal>
    </aside>
  );
}
