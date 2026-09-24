import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderGit2, Plus, Github, Trash2, GitBranch, FolderOpen } from 'lucide-react';
import { useStore } from '../lib/store';
import { action, rpc } from '../lib/api';
import type { GithubRepository } from '../lib/types';
import { Button, Empty, Modal, PageHeading } from './ui';
export function Projects() {
  const store = useStore();
  const [github, setGithub] = useState(false);
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<GithubRepository[]>([]);
  const [remove, setRemove] = useState<string | null>(null);
  const connect = () =>
    action(async () => {
      const path = await open({
        directory: true,
        multiple: false,
        title: 'Choose a Git repository',
      });
      if (!path) return;
      await rpc('connect_local_repo', { project_id: store.project?.id, path });
      await store.refresh();
    }, 'Project connected');
  return (
    <>
      <PageHeading
        title="Projects"
        description="Your repositories, with a separate workspace for every task."
        actions={
          <Button variant="solid" onClick={() => void connect()}>
            <Plus size={15} />
            Add project
          </Button>
        }
      />
      <div className="grid gap-4">
        {store.repos.map((repo) => (
          <div key={repo.id} className="flex items-center gap-4 rounded-xl border border-line p-5">
            <div className="rounded-xl bg-elevated p-3">
              <FolderGit2 size={23} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">{repo.name}</h2>
              <p className="mt-1.5 truncate text-xs text-muted">
                {repo.local_path || repo.remote_url}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <GitBranch size={13} />
              {repo.default_branch}
            </span>
            <Button aria-label={`Remove ${repo.name}`} onClick={() => setRemove(repo.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      {!store.repos.length && (
        <div className="rounded-2xl border border-line">
          <Empty icon={<FolderGit2 size={28} />} title="Give your next idea a home">
            <p>
              Connect a local repository or clone one from GitHub. Perpetual keeps agent changes
              isolated until you review them.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="solid" onClick={() => void connect()}>
                <FolderOpen size={15} />
                Choose a folder
              </Button>
              <Button variant="outline" onClick={() => setGithub(true)}>
                <Github size={15} />
                From GitHub
              </Button>
            </div>
          </Empty>
        </div>
      )}
      {store.repos.length > 0 && (
        <Button variant="outline" className="mt-5" onClick={() => setGithub(true)}>
          <Github size={15} />
          Connect GitHub repository
        </Button>
      )}
      <Modal
        open={github}
        onOpenChange={(v) => {
          setGithub(v);
          if (!v) {
            setToken('');
            setRepos([]);
          }
        }}
        title="Connect GitHub"
        description="Enter a GitHub token with access to the repository. It is used for this connection and is not saved in browser storage."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () =>
              setRepos(await rpc<GithubRepository[]>('github_list_repositories', { token })),
            );
          }}
          className="flex gap-2"
        >
          <input
            aria-label="GitHub token"
            autoComplete="off"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="min-w-0 flex-1"
            placeholder="GitHub personal access token"
          />
          <Button type="submit" variant="solid">
            Load repositories
          </Button>
        </form>
        <div className="mt-5 max-h-72 overflow-auto">
          {repos.map((repo) => (
            <button
              key={repo.full_name}
              className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm hover:bg-hover"
              onClick={() =>
                void action(async () => {
                  await rpc('connect_github_repo', {
                    token,
                    input: { ...repo, project_id: store.project?.id },
                  });
                  await store.refresh();
                  setGithub(false);
                  setToken('');
                  setRepos([]);
                }, 'Repository connected')
              }
            >
              <Github size={15} />
              {repo.full_name}
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Disconnect this project?"
        description="The repository on disk will remain. Existing tasks keep their worktree history."
      >
        <Button
          variant="solid"
          onClick={() =>
            void action(async () => {
              await rpc('delete_repo', { repo_id: remove });
              await store.refresh();
              setRemove(null);
            })
          }
        >
          Disconnect project
        </Button>
      </Modal>
    </>
  );
}
