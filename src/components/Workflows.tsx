import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Workflow,
  Plus,
  Play,
  Square,
  Trash2,
  CornerDownRight,
  ArrowUpRight,
  FolderOpen,
  FolderGit2,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import { PROVIDERS, errorMessage, providerName, statusInfo } from '../lib/format';
import type { AgentKind, Repo, WorkGraph, WorkNode } from '../lib/types';
import { useAddFolder } from './AddFolder';
import {
  Button,
  Card,
  Confirm,
  ContextActions,
  Dot,
  Empty,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  Modal,
  MoreActions,
  PageHeading,
  ProviderLogo,
  Select,
  Tip,
  type Action,
} from './ui';

const RUNNING = ['running', 'running_in_cloud', 'awaiting_approval', 'queued'];

/** Orders nodes as a tree: each step followed by the steps that come after it. */
function flatten(nodes: WorkNode[]) {
  const byParent = new Map<string | null, WorkNode[]>();
  const ids = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    const parent = node.parent_id && ids.has(node.parent_id) ? node.parent_id : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), node]);
  }
  const out: { node: WorkNode; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    const children = (byParent.get(parent) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    for (const node of children) {
      out.push({ node, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Picks the folder a step works in: a known project or any folder on disk. */
function FolderMenu({
  value,
  onChange,
  trigger,
}: {
  value: string;
  onChange: (repoId: string) => void;
  trigger: ReactNode;
}) {
  const store = useStore();
  const folder = useAddFolder();
  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>{trigger}</MenuTrigger>
        <MenuContent align="start" className="w-64">
          <MenuLabel>Work in</MenuLabel>
          <MenuRadioGroup value={value} onValueChange={onChange}>
            <MenuRadioItem value="">No folder</MenuRadioItem>
            {store.repos.map((repo: Repo) => (
              <MenuRadioItem key={repo.id} value={repo.id}>
                <span className="truncate" title={repo.local_path ?? undefined}>
                  {repo.name}
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem
            onSelect={() =>
              void folder.pick().then((repo) => {
                if (repo) onChange(repo.id);
              })
            }
          >
            <FolderOpen size={14} className="text-muted" />
            Choose a folder…
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      {folder.dialog}
    </>
  );
}

export function Workflows({ onSelect }: { onSelect: (id: string) => void }) {
  const store = useStore();
  const [graph, setGraph] = useState<WorkGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState<{ parent: string } | null>(null);
  const [remove, setRemove] = useState<WorkNode | null>(null);
  const load = async () => {
    if (!store.project || !native) return;
    try {
      setGraph(await rpc<WorkGraph>('get_work_graph', { project_id: store.project.id }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    void load();
  }, [store.project?.id, store.revision]);
  const rows = useMemo(
    () => flatten((graph?.nodes ?? []).filter((n) => n.kind !== 'milestone' || n.title)),
    [graph],
  );
  const folderOf = (node: WorkNode) =>
    graph?.repo_bindings.find((b) => b.node_id === node.id)?.repo_id ?? '';
  const setFolder = (node: WorkNode, repoId: string) =>
    void action(async () => {
      await rpc('assign_work_node_repos', { node_id: node.id, repo_ids: repoId ? [repoId] : [] });
      await load();
    });
  const stop = (node: WorkNode) =>
    void action(async () => {
      await rpc('stop_work_node', { node_id: node.id });
      await load();
    });
  const nodeActions = (node: WorkNode): Action[] => {
    const running = RUNNING.includes(node.status);
    const runnable = node.kind === 'session' || node.kind === 'task';
    return [
      ...(node.thread_id
        ? [{ label: 'Open task', icon: ArrowUpRight, onSelect: () => onSelect(node.thread_id!) }]
        : []),
      ...(running
        ? [{ label: 'Stop', icon: Square, onSelect: () => stop(node) }]
        : runnable
          ? [{ label: 'Run', icon: Play, onSelect: () => void run(node) }]
          : []),
      {
        label: 'Add a step after this',
        icon: CornerDownRight,
        onSelect: () => setAdd({ parent: node.id }),
      },
      {
        label: 'Delete',
        icon: Trash2,
        danger: true,
        separated: true,
        onSelect: () => setRemove(node),
      },
    ];
  };
  const run = (node: WorkNode) =>
    action(async () => {
      await rpc('run_work_node', {
        node_id: node.id,
        agent: node.primary_agent || 'codex',
        permission: 'workspace_write',
        execution_backend: null,
      });
      await store.refresh();
    });
  return (
    <>
      <PageHeading
        title="Workflows"
        description="Chain tasks into steps. Each step runs as its own task and starts with what the steps before it learned."
        actions={
          rows.length > 0 && (
            <Button variant="primary" onClick={() => setAdd({ parent: '' })} disabled={!native}>
              <Plus size={15} />
              Add step
            </Button>
          )
        }
      />
      {error ? (
        <Card>
          <Empty title="Couldn't load workflows">{error}</Empty>
        </Card>
      ) : rows.length ? (
        <Card className="overflow-hidden">
          {rows.map(({ node, depth }) => {
            const status = statusInfo(node.status);
            const running = RUNNING.includes(node.status);
            const repoId = folderOf(node);
            const repo = store.repos.find((r) => r.id === repoId);
            return (
              <ContextActions key={node.id} actions={nodeActions(node)}>
                <div
                  className="group flex min-h-12 items-center gap-3 border-b border-line/60 py-2 pr-3 last:border-0"
                  style={{ paddingLeft: 16 + depth * 22 }}
                >
                  {depth > 0 && <CornerDownRight size={13} className="-ml-1 shrink-0 text-faint" />}
                  <Tip label={status.label}>
                    <span className="flex">
                      <Dot tone={status.tone} live={status.live} />
                    </span>
                  </Tip>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{node.title || 'Untitled step'}</div>
                    {node.description && node.description !== node.title && (
                      <div className="mt-0.5 truncate text-xs text-muted">{node.description}</div>
                    )}
                  </div>
                  <FolderMenu
                    value={repoId}
                    onChange={(id) => setFolder(node, id)}
                    trigger={
                      <button
                        disabled={running}
                        title={repo?.local_path ?? 'Choose the folder this step works in'}
                        className="hidden h-7 max-w-40 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover hover:text-ink disabled:opacity-50 data-[state=open]:bg-hover sm:flex"
                      >
                        <FolderGit2 size={13} className="shrink-0" />
                        <span className="truncate">{repo?.name ?? 'No folder'}</span>
                      </button>
                    }
                  />
                  {node.primary_agent && <ProviderLogo agent={node.primary_agent} size={14} />}
                  {node.thread_id && (
                    <Button size="sm" onClick={() => onSelect(node.thread_id!)}>
                      Open
                      <ArrowUpRight size={12} />
                    </Button>
                  )}
                  {running ? (
                    <Button size="sm" variant="secondary" onClick={() => stop(node)}>
                      <Square size={10} fill="currentColor" />
                      Stop
                    </Button>
                  ) : (
                    (node.kind === 'session' || node.kind === 'task') && (
                      <Button size="sm" variant="secondary" onClick={() => void run(node)}>
                        <Play size={11} fill="currentColor" />
                        Run
                      </Button>
                    )
                  )}
                  <MoreActions label={`Options for ${node.title}`} actions={nodeActions(node)} />
                </div>
              </ContextActions>
            );
          })}
        </Card>
      ) : (
        <Card>
          <Empty
            icon={<Workflow size={26} strokeWidth={1.5} />}
            title={graph || !native ? 'No workflows yet' : 'Loading…'}
            action={
              (graph || !native) && (
                <Button variant="primary" onClick={() => setAdd({ parent: '' })} disabled={!native}>
                  <Plus size={14} />
                  Add a step
                </Button>
              )
            }
          >
            {(graph || !native) &&
              'Tasks you start appear here too, so you can add the steps that follow them.'}
          </Empty>
        </Card>
      )}
      <AddStep
        open={!!add}
        parent={add?.parent ?? ''}
        nodes={graph?.nodes ?? []}
        onClose={() => setAdd(null)}
        onCreated={load}
      />
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Delete this step?"
        description={
          <>
            <span className="text-ink">{remove?.title || 'Untitled step'}</span>
            {remove?.thread_id
              ? ' and its task conversation will be deleted.'
              : ' will be removed from the workflow.'}
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={() =>
          action(async () => {
            await rpc('delete_work_node', { node_id: remove!.id });
            await load();
            await store.refresh();
          })
        }
      />
    </>
  );
}

function AddStep({
  open,
  parent: initialParent,
  nodes,
  onClose,
  onCreated,
}: {
  open: boolean;
  parent: string;
  nodes: WorkNode[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const store = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agent, setAgent] = useState<AgentKind>('codex');
  const [parent, setParent] = useState('');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setParent(initialParent);
      setTitle('');
      setDescription('');
      setRepo(store.repos.length === 1 ? store.repos[0].id : '');
    }
  }, [open, initialParent]);
  const chosen = store.repos.find((r) => r.id === repo);
  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await action(async () => {
      await rpc('create_work_node', {
        project_id: store.project?.id,
        title: title.trim(),
        description: description.trim() || title.trim(),
        primary_agent: agent,
        parent_id: parent || null,
        repo_ids: repo ? [repo] : [],
        kind: 'session',
      });
      await onCreated();
      await store.refresh();
      return true;
    });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Add a step"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!title.trim()}
            onClick={() => void create()}
          >
            Add step
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="grid gap-1.5 text-[13px]">
          Name
          <input
            autoFocus
            placeholder="Add sign-in with GitHub"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-[13px]">
          Instructions
          <textarea
            className="field resize-none"
            rows={4}
            placeholder="What should this step get done?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-[13px]">
            Agent
            <Select value={agent} onChange={(e) => setAgent(e.target.value as AgentKind)}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {providerName(p)}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-1.5 text-[13px]">
            Folder
            <FolderMenu
              value={repo}
              onChange={setRepo}
              trigger={
                <button
                  type="button"
                  title={chosen?.local_path ?? undefined}
                  className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-line bg-elevated px-3 text-left text-[13px] hover:bg-hover data-[state=open]:border-muted"
                >
                  <FolderGit2 size={14} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{chosen?.name ?? 'No folder'}</span>
                  <ChevronDown size={14} className="shrink-0 text-muted" />
                </button>
              }
            />
          </div>
        </div>
        <label className="grid gap-1.5 text-[13px]">
          Runs after
          <Select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Nothing (starts a new workflow)</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || 'Untitled step'}
              </option>
            ))}
          </Select>
        </label>
      </form>
    </Modal>
  );
}
