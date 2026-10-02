import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  ChevronRight,
  Pencil,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import {
  canMoveInto,
  reorderedSiblingIds,
  workflowPath,
  workflowSiblings,
} from '../lib/workflowTree';
import { PROVIDERS, errorMessage, providerName, statusInfo } from '../lib/format';
import type {
  AgentKind,
  PermissionPolicy,
  Repo,
  WorkGraph,
  WorkNode,
  WorkNodeUpdate,
  WorkPlanRun,
} from '../lib/types';
import { useAddFolder } from './AddFolder';
import { WorkflowDetails } from './WorkflowDetails';
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
  const [plans, setPlans] = useState<WorkPlanRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState<{ parent: string | null; kind: 'session' | 'group' } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [rename, setRename] = useState<WorkNode | null>(null);
  const [moving, setMoving] = useState<WorkNode | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const dragged = useRef<string | null>(null);
  const [remove, setRemove] = useState<WorkNode | null>(null);
  const load = async () => {
    if (!store.project || !native) return;
    try {
      const [nextGraph, nextPlans] = await Promise.all([
        rpc<WorkGraph>('get_work_graph', { project_id: store.project.id }),
        rpc<WorkPlanRun[]>('list_work_plan_runs', { project_id: store.project.id }),
      ]);
      setGraph(nextGraph);
      setPlans(nextPlans);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    void load();
  }, [store.project?.id, store.revision]);
  useEffect(() => setCurrent(null), [store.project?.id]);
  const nodes = useMemo(
    () => (graph && graph.project_id === store.project?.id ? graph.nodes : []),
    [graph, store.project?.id],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const active = current && byId.has(current) ? current : null;
  const selected = active ? (byId.get(active) ?? null) : null;
  const selectedPlan = active ? (plans.find((plan) => plan.root_node_id === active) ?? null) : null;
  const rows = useMemo(() => workflowSiblings(nodes, active), [nodes, active]);
  const children = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => {
      if (n.parent_id) counts.set(n.parent_id, (counts.get(n.parent_id) ?? 0) + 1);
    });
    return counts;
  }, [nodes]);
  const crumbs = useMemo(() => workflowPath(nodes, active), [nodes, active]);
  const endDrag = () => {
    dragged.current = null;
    setDragging(null);
    setOver(null);
  };
  const saveOrder = (ids: string[]) => {
    if (!store.project) return;
    void action(async () => {
      await rpc('reorder_work_nodes', {
        project_id: store.project!.id,
        parent_id: active,
        node_ids: ids,
      });
      await load();
    });
  };
  const drop = (target: string, after: boolean) => {
    const source = dragged.current;
    if (!source || source === target || !store.project) return;
    const ids = reorderedSiblingIds(rows, source, target, after);
    if (ids) saveOrder(ids);
  };
  const nudge = (id: string, delta: number) => {
    const ids = rows.map((n) => n.id);
    const index = ids.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    saveOrder(ids);
  };
  const folderOf = (node: WorkNode) =>
    graph?.repo_bindings.find((b) => b.node_id === node.id)?.repo_id ?? '';
  const setFolder = async (node: WorkNode, repoId: string) =>
    await action(async () => {
      await rpc('assign_work_node_repos', { node_id: node.id, repo_ids: repoId ? [repoId] : [] });
      await load();
    });
  const saveDetails = async (node: WorkNode, patch: WorkNodeUpdate) => {
    const result = await action(async () => {
      await rpc('update_work_node', { node_id: node.id, patch });
      await load();
      await store.refresh();
      return true;
    });
    return !!result;
  };
  const startWorkflow = (node: WorkNode) =>
    void action(async () => {
      await rpc('start_workflow', { root_node_id: node.id });
      await load();
    });
  const stopWorkflow = (planId: string) =>
    void action(async () => {
      await rpc('stop_work_plan', { plan_run_id: planId });
      await load();
    });
  const resumeWorkflow = (planId: string) =>
    void action(async () => {
      await rpc('resume_work_plan', { plan_run_id: planId });
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
        label: 'Add subtask',
        icon: CornerDownRight,
        onSelect: () => setAdd({ parent: node.id, kind: 'session' }),
      },
      {
        label: 'Add group',
        icon: FolderOpen,
        onSelect: () => setAdd({ parent: node.id, kind: 'group' }),
      },
      { label: 'Rename', icon: Pencil, onSelect: () => setRename(node) },
      { label: 'Move to…', icon: FolderOpen, onSelect: () => setMoving(node) },
      ...(rows.some((n) => n.id === node.id)
        ? [
            {
              label: 'Move up',
              icon: ArrowUp,
              disabled: rows[0]?.id === node.id,
              onSelect: () => nudge(node.id, -1),
            },
            {
              label: 'Move down',
              icon: ArrowDown,
              disabled: rows[rows.length - 1]?.id === node.id,
              onSelect: () => nudge(node.id, 1),
            },
          ]
        : []),
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
        permission: node.workflow_permission,
        execution_backend: null,
      });
      await store.refresh();
    });
  return (
    <>
      <PageHeading
        title="Workflows"
        description="Select a task to edit its instructions and run its subtasks in order."
        actions={
          nodes.length > 0 &&
          !active && (
            <Button
              variant="primary"
              onClick={() => setAdd({ parent: active, kind: 'session' })}
              disabled={!native}
            >
              <Plus size={15} />
              {active ? 'Add subtask' : 'Add task'}
            </Button>
          )
        }
      />
      {nodes.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted"
          aria-label="Workflow location"
        >
          <button
            className="rounded px-2 py-1 hover:bg-hover hover:text-ink"
            onClick={() => setCurrent(null)}
          >
            All tasks
          </button>
          {crumbs.map((node, index) => (
            <span key={node.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight size={14} className="shrink-0" />
              {index === crumbs.length - 1 ? (
                <span
                  className="max-w-56 truncate px-2 py-1 font-medium text-ink"
                  title={node.title}
                >
                  {node.title || 'Untitled task'}
                </span>
              ) : (
                <button
                  className="max-w-48 truncate rounded px-2 py-1 hover:bg-hover hover:text-ink"
                  onClick={() => setCurrent(node.id)}
                  title={node.title}
                >
                  {node.title || 'Untitled task'}
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {selected && (
        <WorkflowDetails
          key={selected.id}
          node={selected}
          models={store.models}
          repos={store.repos}
          repoId={folderOf(selected)}
          childCount={children.get(selected.id) ?? 0}
          plan={selectedPlan}
          onSave={(patch) => saveDetails(selected, patch)}
          onFolder={async (id) => {
            await setFolder(selected, id);
          }}
          onRun={() => startWorkflow(selected)}
          onStop={() => selectedPlan && stopWorkflow(selectedPlan.id)}
          onResume={() => selectedPlan && resumeWorkflow(selectedPlan.id)}
          onOpen={onSelect}
        />
      )}
      {selected && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Subtasks</h3>
            <p className="mt-0.5 text-xs text-muted">Drag to set the order they run.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdd({ parent: active, kind: 'group' })}
            >
              <Plus size={13} /> Group
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAdd({ parent: active, kind: 'session' })}
            >
              <Plus size={13} /> Subtask
            </Button>
          </div>
        </div>
      )}
      {!selected && nodes.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAdd({ parent: null, kind: 'group' })}
          >
            <Plus size={13} /> New group
          </Button>
        </div>
      )}
      {error ? (
        <Card>
          <Empty title="Couldn't load workflows">{error}</Empty>
        </Card>
      ) : rows.length ? (
        <Card className="overflow-hidden">
          {rows.map((node) => {
            const status = statusInfo(node.status);
            const running = RUNNING.includes(node.status);
            const repoId = folderOf(node);
            const repo = store.repos.find((r) => r.id === repoId);
            return (
              <ContextActions key={node.id} actions={nodeActions(node)}>
                <div
                  className="group relative flex min-h-14 items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0 hover:bg-hover/35"
                  onDragOver={(e) => {
                    if (!dragged.current) return;
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    setOver({ id: node.id, after: e.clientY > box.top + box.height / 2 });
                  }}
                  onDragLeave={() => setOver((v) => (v?.id === node.id ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    drop(node.id, e.clientY > box.top + box.height / 2);
                    endDrag();
                  }}
                >
                  {over?.id === node.id && dragging !== node.id && (
                    <span
                      className={`absolute inset-x-2 h-0.5 bg-accent ${over.after ? 'bottom-0' : 'top-0'}`}
                    />
                  )}
                  <span
                    draggable
                    onDragStart={(e) => {
                      dragged.current = node.id;
                      setDragging(node.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', node.id);
                    }}
                    onDragEnd={endDrag}
                    className="cursor-grab rounded p-0.5 text-faint hover:text-muted"
                    aria-label={`Drag to reorder ${node.title}`}
                    title="Drag to reorder"
                  >
                    <GripVertical size={15} />
                  </span>
                  <Tip label={status.label}>
                    <span className="flex">
                      <Dot tone={status.tone} live={status.live} />
                    </span>
                  </Tip>
                  <button
                    className="min-w-0 flex-1 py-1 text-left hover:text-accent"
                    onClick={() => setCurrent(node.id)}
                    title={`View subtasks of ${node.title}`}
                  >
                    <div className="flex items-center gap-2.5 text-[13px]">
                      <span className="truncate font-medium">{node.title || 'Untitled task'}</span>
                      {node.kind === 'group' && (
                        <span className="shrink-0 rounded-md border border-line/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                          Group
                        </span>
                      )}
                      {!!children.get(node.id) && (
                        <span className="shrink-0 rounded-md bg-hover px-1.5 py-0.5 text-[11px] tabular-nums text-muted">
                          {children.get(node.id)}
                        </span>
                      )}
                    </div>
                    {node.description && node.description !== node.title && (
                      <div className="mt-0.5 truncate text-xs text-muted">{node.description}</div>
                    )}
                  </button>
                  {node.kind !== 'group' && (
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
                  )}
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
            title={active ? 'No subtasks yet' : graph || !native ? 'No workflows yet' : 'Loading…'}
            action={
              !selected &&
              (graph || !native) && (
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => setAdd({ parent: active, kind: 'session' })}
                    disabled={!native}
                  >
                    <Plus size={14} />
                    {active ? 'Add subtask' : 'Add a task'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setAdd({ parent: active, kind: 'group' })}
                    disabled={!native}
                  >
                    Add group
                  </Button>
                </div>
              )
            }
          >
            {(graph || !native) &&
              (active
                ? 'Add a task or group inside this item.'
                : 'Tasks you start appear here too, so you can organize them into subtasks.')}
          </Empty>
        </Card>
      )}
      <AddStep
        open={!!add}
        parent={add?.parent ?? null}
        kind={add?.kind ?? 'session'}
        parentTitle={add?.parent ? (byId.get(add.parent)?.title ?? null) : null}
        onClose={() => setAdd(null)}
        onCreated={load}
      />
      <RenameNode node={rename} onClose={() => setRename(null)} onSaved={load} />
      <MoveNode node={moving} nodes={nodes} onClose={() => setMoving(null)} onSaved={load} />
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Delete this step?"
        description={
          <>
            <span className="text-ink">{remove?.title || 'Untitled task'}</span>
            {remove?.thread_id
              ? ' and its task conversation will be deleted.'
              : ' will be removed from the workflow.'}
            {!!remove && !!children.get(remove.id) && ' Its subtasks will move to the top level.'}
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
  kind,
  parentTitle,
  onClose,
  onCreated,
}: {
  open: boolean;
  parent: string | null;
  kind: 'session' | 'group';
  parentTitle: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const store = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agent, setAgent] = useState<AgentKind>('codex');
  const [model, setModel] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [permission, setPermission] = useState<PermissionPolicy>('workspace_write');
  const [limit, setLimit] = useState<'inherit' | 'switch' | 'wait'>('inherit');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setModel('');
      setReasoning('');
      setPermission('workspace_write');
      setLimit('inherit');
      setRepo(store.repos.length === 1 ? store.repos[0].id : '');
    }
  }, [open, initialParent]);
  const chosen = store.repos.find((r) => r.id === repo);
  const catalog = store.models.find((item) => item.agent === agent);
  const efforts =
    catalog?.models.find((item) => item.id === model)?.reasoning ?? catalog?.reasoning ?? [];
  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await action(async () => {
      await rpc('create_work_node', {
        project_id: store.project?.id,
        title: title.trim(),
        description: kind === 'group' ? null : description.trim() || title.trim(),
        primary_agent: kind === 'group' ? null : agent,
        model: kind === 'group' ? null : model || null,
        reasoning: kind === 'group' ? null : reasoning || null,
        permission,
        limit_behavior: limit,
        parent_id: initialParent,
        repo_ids: kind === 'group' || !repo ? [] : [repo],
        kind,
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
      title={kind === 'group' ? 'Add a group' : initialParent ? 'Add subtask' : 'Add task'}
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
            {kind === 'group' ? 'Add group' : initialParent ? 'Add subtask' : 'Add task'}
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
            placeholder={kind === 'group' ? 'Launch preparation' : 'Add sign-in with GitHub'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {kind !== 'group' && (
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
        )}
        {kind !== 'group' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px]">
              Agent
              <Select
                value={agent}
                onChange={(e) => {
                  setAgent(e.target.value as AgentKind);
                  setModel('');
                  setReasoning('');
                }}
              >
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
        )}
        {kind !== 'group' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px]">
              Model
              <Select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setReasoning('');
                }}
              >
                <option value="">Default model</option>
                {catalog?.models
                  .filter((item) => item.available)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="grid gap-1.5 text-[13px]">
              Reasoning
              <Select
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                disabled={!efforts.length}
              >
                <option value="">Default</option>
                {efforts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        )}
        {kind !== 'group' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px]">
              Access
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as PermissionPolicy)}
              >
                <option value="read_only">{agent === 'codex' ? 'Read only' : 'Plan'}</option>
                <option value="workspace_write">
                  {agent === 'codex' ? 'Workspace write' : 'Accept edits'}
                </option>
                <option value="ask">Ask first</option>
                <option value="autonomous">
                  {agent === 'codex' ? 'Full access' : 'Bypass permissions'}
                </option>
              </Select>
            </label>
            <label className="grid gap-1.5 text-[13px]">
              At a rate limit
              <Select value={limit} onChange={(e) => setLimit(e.target.value as typeof limit)}>
                <option value="inherit">Automatic (recommended)</option>
                <option value="switch">Switch if available</option>
                <option value="wait">Wait for this agent</option>
              </Select>
            </label>
          </div>
        )}
        {parentTitle && <p className="text-xs text-muted">Inside {parentTitle}</p>}
      </form>
    </Modal>
  );
}

function RenameNode({
  node,
  onClose,
  onSaved,
}: {
  node: WorkNode | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (node) setTitle(node.title);
  }, [node?.id]);
  const save = async () => {
    if (!node || !title.trim() || title.trim() === node.title) {
      onClose();
      return;
    }
    setBusy(true);
    const ok = await action(async () => {
      await rpc('update_work_node', { node_id: node.id, patch: { title: title.trim() } });
      await onSaved();
      return true;
    });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open={!!node}
      onOpenChange={(v) => !v && onClose()}
      title="Rename task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!title.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="grid gap-1.5 text-[13px]">
          Name
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}

function MoveNode({
  node,
  nodes,
  onClose,
  onSaved,
}: {
  node: WorkNode | null;
  nodes: WorkNode[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setParent(node?.parent_id ?? '');
  }, [node?.id]);
  const save = async () => {
    if (!node || (parent || null) === node.parent_id) {
      onClose();
      return;
    }
    setBusy(true);
    const ok = await action(async () => {
      await rpc('move_work_node', {
        node_id: node.id,
        parent_id: parent || null,
        position_x: node.position_x,
        position_y: node.position_y,
      });
      await onSaved();
      return true;
    });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open={!!node}
      onOpenChange={(v) => !v && onClose()}
      title="Move task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Move
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">Choose where {node?.title || 'this task'} belongs.</p>
      <Select value={parent} onChange={(e) => setParent(e.target.value)} aria-label="Move into">
        <option value="">Top level</option>
        {workflowSiblings(nodes, null)
          .concat(nodes.filter((n) => n.parent_id !== null))
          .filter((candidate) => !!node && canMoveInto(nodes, node.id, candidate.id))
          .map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title || 'Untitled task'}
            </option>
          ))}
      </Select>
    </Modal>
  );
}
