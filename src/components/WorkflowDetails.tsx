import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Play, Square, Workflow } from 'lucide-react';
import type {
  AgentKind,
  AgentModelCatalog,
  PermissionPolicy,
  Repo,
  WorkNode,
  WorkNodeUpdate,
} from '../lib/types';
import { providerName, statusInfo } from '../lib/format';
import { Button, Card, Dot, Select } from './ui';
import { useAddFolder } from './AddFolder';

const access: Record<AgentKind, { value: PermissionPolicy; label: string; detail: string }[]> = {
  codex: [
    { value: 'read_only', label: 'Read only', detail: 'Inspect files; no edits' },
    { value: 'workspace_write', label: 'Workspace write', detail: 'Edit in the workspace sandbox' },
    { value: 'ask', label: 'Ask before gated actions', detail: 'Request approval in Perpetual' },
    { value: 'autonomous', label: 'Full access', detail: 'Bypass approvals and sandbox' },
  ],
  claude_code: [
    { value: 'read_only', label: 'Plan', detail: 'Claude plans without editing' },
    { value: 'workspace_write', label: 'Accept edits', detail: 'Edits proceed without prompts' },
    { value: 'ask', label: 'Ask before tools', detail: 'Request approval in Perpetual' },
    { value: 'autonomous', label: 'Bypass permissions', detail: 'Claude proceeds without prompts' },
  ],
};

export function WorkflowDetails({
  node,
  models,
  repos,
  repoId,
  childCount,
  plan,
  onSave,
  onFolder,
  onRun,
  onStop,
  onResume,
  onOpen,
}: {
  node: WorkNode;
  models: AgentModelCatalog[];
  repos: Repo[];
  repoId: string;
  childCount: number;
  plan: {
    id: string;
    state: string;
    completed_count: number;
    total_count: number;
    error?: string | null;
  } | null;
  onSave: (patch: WorkNodeUpdate) => Promise<boolean>;
  onFolder: (id: string) => Promise<void>;
  onRun: () => void;
  onStop: () => void;
  onResume: () => void;
  onOpen: (id: string) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? '');
  const [agent, setAgent] = useState<AgentKind>(node.primary_agent ?? 'codex');
  const [model, setModel] = useState(node.workflow_model ?? '');
  const [reasoning, setReasoning] = useState(node.workflow_reasoning ?? '');
  const [permission, setPermission] = useState<PermissionPolicy>(node.workflow_permission);
  const [limit, setLimit] = useState(node.workflow_limit_behavior);
  const [folder, setFolder] = useState(repoId);
  const [busy, setBusy] = useState(false);
  const folderPicker = useAddFolder();
  useEffect(() => {
    setTitle(node.title);
    setDescription(node.description ?? '');
    setAgent(node.primary_agent ?? 'codex');
    setModel(node.workflow_model ?? '');
    setReasoning(node.workflow_reasoning ?? '');
    setPermission(node.workflow_permission);
    setLimit(node.workflow_limit_behavior);
    setFolder(repoId);
  }, [node.id, node.updated_at, repoId]);
  const catalog = models.find((item) => item.agent === agent);
  const chosen = catalog?.models.find((item) => item.id === model);
  const efforts = chosen?.reasoning ?? catalog?.reasoning ?? [];
  const options = useMemo(
    () => catalog?.models.filter((item) => item.available || item.id === model) ?? [],
    [catalog, model],
  );
  const runnable = node.kind === 'session' || node.kind === 'task';
  const running = plan?.state === 'running';
  const paused = plan?.state === 'paused';
  const changed =
    title.trim() !== node.title ||
    description !== (node.description ?? '') ||
    agent !== (node.primary_agent ?? 'codex') ||
    model !== (node.workflow_model ?? '') ||
    reasoning !== (node.workflow_reasoning ?? '') ||
    permission !== node.workflow_permission ||
    limit !== node.workflow_limit_behavior ||
    folder !== repoId;
  const save = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const saved = await onSave({
      title: title.trim(),
      description,
      primary_agent: runnable ? agent : undefined,
      workflow_model: model,
      workflow_reasoning: reasoning,
      workflow_permission: permission,
      workflow_limit_behavior: limit,
    });
    if (saved && folder !== repoId) await onFolder(folder);
    setBusy(false);
  };
  const status = statusInfo(node.status);
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/70 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
            <Workflow size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold tracking-tight">
                {node.title || 'Untitled task'}
              </h2>
              <span className="rounded-md bg-hover px-2 py-0.5 text-[11px] text-muted">
                {node.kind === 'group' ? 'Group' : 'Task'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <Dot tone={status.tone} live={status.live} />
              {status.label}
              <span className="text-faint">·</span>
              {childCount} {childCount === 1 ? 'subtask' : 'subtasks'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {node.thread_id && (
            <Button size="sm" variant="secondary" onClick={() => onOpen(node.thread_id!)}>
              Open conversation <ArrowUpRight size={13} />
            </Button>
          )}
          {running ? (
            <Button size="sm" variant="secondary" onClick={onStop}>
              <Square size={12} /> Stop workflow
            </Button>
          ) : paused ? (
            <>
              <Button size="sm" variant="secondary" onClick={onStop}>
                <Square size={12} /> Stop
              </Button>
              <Button size="sm" variant="primary" onClick={onResume}>
                <Play size={12} fill="currentColor" /> Resume
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={onRun}
              disabled={!runnable && childCount === 0}
            >
              <Play size={12} fill="currentColor" /> Run in order
            </Button>
          )}
        </div>
      </div>
      {plan && (
        <div className="border-b border-line/70 bg-hover/30 px-5 py-2 text-xs text-muted sm:px-6">
          Workflow {plan.state} · {plan.completed_count} of {plan.total_count} complete
          {plan.error && <span className="ml-2 text-warning">{plan.error}</span>}
        </div>
      )}
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="grid content-start gap-4">
          <label className="grid gap-1.5 text-xs font-medium text-muted">
            Name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Task name"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted">
            {runnable ? 'Instructions' : 'Description'}
            <textarea
              className="field min-h-32 resize-y text-[13px] font-normal leading-5"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                runnable
                  ? 'Describe what this task should accomplish…'
                  : 'What does this group contain?'
              }
              aria-label="Task instructions"
            />
          </label>
        </div>
        {runnable && (
          <div className="grid content-start grid-cols-2 gap-3">
            <label className="col-span-2 grid gap-1.5 text-xs font-medium text-muted sm:col-span-1">
              Agent
              <Select
                value={agent}
                onChange={(event) => {
                  setAgent(event.target.value as AgentKind);
                  setModel('');
                  setReasoning('');
                }}
              >
                {(['codex', 'claude_code'] as AgentKind[]).map((item) => (
                  <option value={item} key={item}>
                    {providerName(item)}
                  </option>
                ))}
              </Select>
            </label>
            <div className="col-span-2 grid gap-1.5 text-xs font-medium text-muted sm:col-span-1">
              <label htmlFor="workflow-folder">Folder</label>
              <div className="flex gap-1">
                <Select
                  id="workflow-folder"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                >
                  <option value="">No folder</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.name}
                    </option>
                  ))}
                </Select>
                <button
                  className="rounded-md border border-line px-2 text-xs hover:bg-hover"
                  title="Choose a folder"
                  onClick={() =>
                    void folderPicker.pick().then((repo) => {
                      if (repo) setFolder(repo.id);
                    })
                  }
                >
                  Browse
                </button>
              </div>
            </div>
            <label className="col-span-2 grid gap-1.5 text-xs font-medium text-muted sm:col-span-1">
              Model
              <Select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setReasoning('');
                }}
              >
                <option value="">Default model</option>
                {model && !options.some((item) => item.id === model) && (
                  <option value={model}>{model}</option>
                )}
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 grid gap-1.5 text-xs font-medium text-muted sm:col-span-1">
              Reasoning
              <Select
                value={reasoning}
                onChange={(event) => setReasoning(event.target.value)}
                disabled={!efforts.length}
              >
                <option value="">Default reasoning</option>
                {efforts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 grid gap-1.5 text-xs font-medium text-muted">
              Access
              <Select
                value={permission}
                onChange={(event) => setPermission(event.target.value as PermissionPolicy)}
              >
                {access[agent].map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} · {item.detail}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 grid gap-1.5 text-xs font-medium text-muted">
              At a rate limit
              <Select
                value={limit}
                onChange={(event) => setLimit(event.target.value as typeof limit)}
              >
                <option value="inherit">Automatic · follow your account settings</option>
                <option value="switch">Switch to an available account or agent</option>
                <option value="wait">Wait for this agent to recover</option>
              </Select>
            </label>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-line/70 px-5 py-3 sm:px-6">
        <span className="mr-auto text-xs text-faint">Changes affect the next run.</span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void save()}
          disabled={!changed || !title.trim()}
          loading={busy}
        >
          Save changes
        </Button>
      </div>
      {folderPicker.dialog}
    </Card>
  );
}
