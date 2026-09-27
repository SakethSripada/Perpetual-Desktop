import { useMemo, useState } from 'react';
import {
  FolderGit2,
  Plus,
  Github,
  Trash2,
  GitBranch,
  FolderOpen,
  Lock,
  Search,
  ChevronDown,
  Copy,
} from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useStore } from '../lib/store';
import { isMac } from '../lib/platform';
import { useAddFolder } from './AddFolder';
import { action, native, rpc } from '../lib/api';
import type { GithubRepository, Repo } from '../lib/types';
import {
  Button,
  Card,
  Confirm,
  ContextActions,
  Empty,
  MoreActions,
  type Action,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
  Modal,
  PageHeading,
} from './ui';

export function Projects() {
  const store = useStore();
  const [github, setGithub] = useState(false);
  const [remove, setRemove] = useState<Repo | null>(null);
  const folder = useAddFolder();
  const connect = () => folder.pick();
  const repoActions = (repo: Repo): Action[] => [
    ...(repo.local_path
      ? [
          {
            label: isMac ? 'Show in Finder' : 'Show in File Explorer',
            icon: FolderOpen,
            onSelect: () => void action(() => revealItemInDir(repo.local_path!)),
          },
          {
            label: 'Copy path',
            icon: Copy,
            onSelect: () =>
              void action(() => navigator.clipboard.writeText(repo.local_path!), 'Path copied'),
          },
        ]
      : []),
    {
      label: 'Remove from Perpetual',
      icon: Trash2,
      danger: true,
      separated: !!repo.local_path,
      onSelect: () => setRemove(repo),
    },
  ];
  const addMenu = (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="primary" disabled={!native}>
          <Plus size={15} />
          Add project
          <ChevronDown size={13} className="-mr-1 opacity-70" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        <MenuItem onSelect={() => void connect()}>
          <FolderOpen size={14} className="text-muted" />
          Choose a folder…
        </MenuItem>
        <MenuItem onSelect={() => setGithub(true)}>
          <Github size={14} className="text-muted" />
          Clone from GitHub…
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
  return (
    <>
      <PageHeading
        title="Projects"
        description="Each task works in its own copy of a project, so nothing changes until you apply it."
        actions={store.repos.length > 0 && addMenu}
      />
      {store.repos.length ? (
        <Card className="overflow-hidden">
          {store.repos.map((repo) => (
            <ContextActions key={repo.id} actions={repoActions(repo)}>
              <div className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0 data-[state=open]:bg-hover">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
                  {repo.kind === 'github' ? <Github size={16} /> : <FolderGit2 size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{repo.name}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted selectable">
                    {repo.local_path || repo.remote_url}
                  </div>
                </div>
                <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:flex">
                  <GitBranch size={12} />
                  {repo.default_branch}
                </span>
                <MoreActions label={`Options for ${repo.name}`} actions={repoActions(repo)} />
              </div>
            </ContextActions>
          ))}
        </Card>
      ) : (
        <Card>
          <Empty
            icon={<FolderGit2 size={26} strokeWidth={1.5} />}
            title="No projects yet"
            action={
              <>
                <Button variant="primary" onClick={() => void connect()} disabled={!native}>
                  <FolderOpen size={14} />
                  Choose a folder
                </Button>
                <Button variant="secondary" onClick={() => setGithub(true)} disabled={!native}>
                  <Github size={14} />
                  Clone from GitHub
                </Button>
              </>
            }
          >
            Add any folder on this computer, or clone a repository from GitHub.
          </Empty>
        </Card>
      )}
      <GithubDialog open={github} onOpenChange={setGithub} />
      {folder.dialog}
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title={`Remove ${remove?.name ?? 'project'}?`}
        description="The folder on your computer isn't touched. Existing tasks keep their history."
        confirmLabel="Remove"
        danger
        onConfirm={() =>
          action(async () => {
            await rpc('delete_repo', { repo_id: remove!.id });
            await store.refresh();
          })
        }
      />
    </>
  );
}

function GithubDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const store = useStore();
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<GithubRepository[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const close = () => {
    onOpenChange(false);
    setToken('');
    setRepos(null);
    setQuery('');
  };
  const filtered = useMemo(
    () =>
      (repos ?? []).filter((r) => r.full_name.toLowerCase().includes(query.trim().toLowerCase())),
    [repos, query],
  );
  const load = async () => {
    setLoading(true);
    const result = await action(() =>
      rpc<GithubRepository[]>('github_list_repositories', { token }),
    );
    if (result) setRepos(result);
    setLoading(false);
  };
  const clone = async (repo: GithubRepository) => {
    setCloning(repo.full_name);
    const ok = await action(async () => {
      await rpc('connect_github_repo', {
        token,
        input: { ...repo, project_id: store.project?.id },
      });
      await store.refresh();
      return true;
    }, `${repo.name} added`);
    setCloning(null);
    if (ok) close();
  };
  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title="Clone from GitHub"
      description={
        repos
          ? 'Choose a repository to clone.'
          : 'Use a personal access token with read access to your repositories. It is only used for this and is not saved.'
      }
      width={520}
    >
      {!repos ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) void load();
          }}
        >
          <input
            autoFocus
            aria-label="GitHub token"
            autoComplete="off"
            type="password"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="min-w-0 flex-1 font-mono"
            placeholder="ghp_… or github_pat_…"
          />
          <Button type="submit" variant="primary" loading={loading} disabled={!token.trim()}>
            Continue
          </Button>
        </form>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute top-2.5 left-3 text-faint" />
            <input
              autoFocus
              aria-label="Filter repositories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter repositories"
              className="w-full !pl-8"
            />
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto">
            {filtered.map((repo) => (
              <button
                key={repo.full_name}
                disabled={!!cloning}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-hover disabled:opacity-50"
                onClick={() => void clone(repo)}
              >
                <Github size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{repo.full_name}</span>
                {repo.private && <Lock size={12} className="shrink-0 text-faint" />}
                {cloning === repo.full_name && <span className="text-xs text-muted">Cloning…</span>}
              </button>
            ))}
            {!filtered.length && (
              <p className="py-8 text-center text-[13px] text-muted">No repositories found</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
