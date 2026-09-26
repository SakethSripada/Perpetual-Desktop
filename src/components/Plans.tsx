import { useEffect, useMemo, useState } from 'react';
import {
  ListTree,
  Plus,
  Play,
  Square,
  Trash2,
  MoreHorizontal,
  CornerDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import { PROVIDERS, errorMessage, providerName, statusInfo } from '../lib/format';
import type { AgentKind, WorkGraph, WorkNode } from '../lib/types';
import {
  Button,
  Card,
  Confirm,
  Dot,
  Empty,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  Modal,
  PageHeading,
  ProviderLogo,
  Select,
  Tip,
} from './ui';

const RUNNING = ['running', 'running_in_cloud', 'awaiting_approval', 'queued'];

/** Orders nodes as a tree: each parent followed by its children. */
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

export function Plans({ onSelect }: { onSelect: (id: string) => void }) {
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
        title="Plans"
        description="Break bigger work into steps. Each step runs as its own task and starts with what earlier steps learned."
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
          <Empty title="Couldn't load plans">{error}</Empty>
        </Card>
      ) : rows.length ? (
        <Card className="overflow-hidden">
          {rows.map(({ node, depth }) => {
            const status = statusInfo(node.status);
            const running = RUNNING.includes(node.status);
            return (
              <div
                key={node.id}
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
                {node.primary_agent && <ProviderLogo agent={node.primary_agent} size={14} />}
                {node.thread_id && (
                  <Button size="sm" onClick={() => onSelect(node.thread_id!)}>
                    Open
                    <ArrowUpRight size={12} />
                  </Button>
                )}
                {running ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void action(async () => {
                        await rpc('stop_work_node', { node_id: node.id });
                        await load();
                      })
                    }
                  >
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
                <MenuRoot>
                  <MenuTrigger asChild>
                    <button
                      aria-label={`Options for ${node.title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="end" className="w-52">
                    <MenuItem onSelect={() => setAdd({ parent: node.id })}>
                      <CornerDownRight size={14} className="text-muted" />
                      Add a step under this
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem danger onSelect={() => setRemove(node)}>
                      <Trash2 size={14} />
                      Delete
                    </MenuItem>
                  </MenuContent>
                </MenuRoot>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card>
          <Empty
            icon={<ListTree size={26} strokeWidth={1.5} />}
            title={graph || !native ? 'No plans yet' : 'Loading…'}
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
              'Tasks you start also appear here, so you can organize follow-up steps beneath them.'}
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
        title={`Delete "${remove?.title ?? 'step'}"?`}
        description={
          remove?.thread_id
            ? 'Its task and conversation will be deleted too.'
            : 'This step will be removed from the plan.'
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
          What should it do?
          <textarea
            className="field resize-none"
            rows={4}
            placeholder="Describe the outcome you want and anything the agent should know."
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
          <label className="grid gap-1.5 text-[13px]">
            Project
            <Select value={repo} onChange={(e) => setRepo(e.target.value)}>
              <option value="">None</option>
              {store.repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="grid gap-1.5 text-[13px]">
          Comes after
          <Select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Nothing — a new plan</option>
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
