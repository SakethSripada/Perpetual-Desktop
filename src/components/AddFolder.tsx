import { useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import { native, rpc } from '../lib/api';
import { errorMessage } from '../lib/format';
import { useStore } from '../lib/store';
import type { Repo } from '../lib/types';
import { Confirm } from './ui';

const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/**
 * Lets people pick any folder as a project. Tasks work on a Git copy of the
 * folder, so a folder without Git is set up only after they agree.
 * Returns `pick`, which resolves to the connected project (or null), and the
 * confirmation dialog to render.
 */
export function useAddFolder() {
  const store = useStore();
  const [pending, setPending] = useState<string | null>(null);
  const settle = useRef<((repo: Repo | null) => void) | null>(null);
  const finish = (repo: Repo | null) => {
    settle.current?.(repo);
    settle.current = null;
    setPending(null);
  };
  const connect = async (path: string, initialize: boolean) => {
    const repo = await rpc<Repo>('connect_local_repo', {
      project_id: store.project?.id,
      path,
      initialize,
    });
    await store.refresh();
    return repo;
  };
  const pick = async (): Promise<Repo | null> => {
    if (!native) return null;
    const path = await open({ directory: true, multiple: false, title: 'Choose a project folder' });
    if (!path || Array.isArray(path)) return null;
    try {
      return await connect(path, false);
    } catch (err) {
      const message = errorMessage(err);
      if (!/not a git repository|no commits yet/i.test(message)) {
        toast.error(message);
        return null;
      }
      return new Promise((resolve) => {
        settle.current = resolve;
        setPending(path);
      });
    }
  };
  const dialog = (
    <Confirm
      open={!!pending}
      onOpenChange={(v) => !v && finish(null)}
      title="Set up Git in this folder?"
      description={
        <>
          Tasks work on their own copy of a project, which uses Git.{' '}
          <span className="text-ink">{pending ? folderName(pending) : ''}</span> doesn't use Git
          yet, so Perpetual will set it up and save the folder's current files as the first commit.
          Your files stay where they are.
        </>
      }
      confirmLabel="Set up Git"
      onConfirm={async () => {
        const path = pending!;
        try {
          const repo = await connect(path, true);
          toast.success(`${repo.name} added`);
          finish(repo);
        } catch (err) {
          toast.error(errorMessage(err));
          finish(null);
        }
      }}
    />
  );
  return { pick, dialog };
}
