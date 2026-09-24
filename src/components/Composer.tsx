import { toast } from 'sonner';
import { commandPrompt, parseCommand, slashCommands } from '../lib/commands';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  FolderGit2,
  Plus,
  Square,
  SlidersHorizontal,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { action, rpc } from '../lib/api';
import type {
  AgentKind,
  AgentThread,
  ExecutionBackend,
  PermissionPolicy,
  TaskBudget,
  AgentThreadRepo,
} from '../lib/types';
import { Button, Modal, ProviderLogo, Select, cn } from './ui';
export interface RunOptions {
  agent: AgentKind;
  permission: PermissionPolicy;
  execution_backend: ExecutionBackend;
  model: string | null;
  reasoning: string | null;
  repo_ids: string[];
  task_budget: TaskBudget;
  local_provider?: string | null;
  local_base_url?: string | null;
}
export function Composer({
  thread,
  busy,
  onSend,
  onStop,
  draft,
  onCommand,
}: {
  thread?: AgentThread;
  draft: { text: string; seq: number };
  onCommand: (name: string) => void;
  busy: boolean;
  onSend: (message: string, options: RunOptions) => Promise<boolean>;
  onStop: () => void;
}) {
  const store = useStore();
  const [text, setText] = useState('');
  const [agent, setAgent] = useState<AgentKind>(thread?.active_agent || 'codex');
  const [model, setModel] = useState(thread?.model || '');
  const [reasoning, setReasoning] = useState(thread?.reasoning || '');
  const [permission, setPermission] = useState<PermissionPolicy>(
    thread?.permission || 'workspace_write',
  );
  const [backend, setBackend] = useState<ExecutionBackend>(thread?.execution_backend || 'host');
  const [repos, setRepos] = useState<string[]>([]);
  const [budget, setBudget] = useState<TaskBudget>(thread?.task_budget || { mode: 'unlimited' });
  const [options, setOptions] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const catalog = store.models.find((m) => m.agent === agent);
  const chosenModel = catalog?.models.find((m) => m.id === model);
  const efforts = chosenModel?.reasoning || catalog?.reasoning || [];
  const running =
    thread && ['running', 'running_in_cloud', 'awaiting_approval'].includes(thread.status);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (draft.seq) {
      setText(draft.text);
      input.current?.focus();
    }
  }, [draft]);
  useEffect(() => {
    if (thread?.active_agent) {
      setAgent(thread.active_agent);
      setModel(thread.model || '');
      setReasoning(thread.reasoning || '');
    }
  }, [thread?.active_agent]);
  useEffect(() => {
    if (thread)
      void action(async () => {
        const links = await rpc<AgentThreadRepo[]>('list_thread_repos', { thread_id: thread.id });
        setRepos(links.map((link) => link.repo_id));
      });
  }, [thread?.id]);
  const send = async () => {
    if (!text.trim() || busy) return;
    let message = text.trim();
    let runPermission = permission;
    const command = parseCommand(message);
    if (command) {
      if (command.name === 'model') {
        if (!command.argument) {
          setOptions(true);
          return;
        }
        setModel(command.argument);
        setReasoning('');
        setText('');
        toast.success('Model updated');
        return;
      }
      if (command.name === 'effort') {
        if (!efforts.includes(command.argument)) {
          setOptions(true);
          toast.info('Choose a supported reasoning level.');
          return;
        }
        setReasoning(command.argument);
        setText('');
        return;
      }
      if (command.name === 'permissions') {
        const map: Record<string, PermissionPolicy> = {
          read: 'read_only',
          'read-only': 'read_only',
          read_only: 'read_only',
          write: 'workspace_write',
          workspace_write: 'workspace_write',
          'workspace-write': 'workspace_write',
          autonomous: 'autonomous',
          'full-access': 'autonomous',
        };
        if (!map[command.argument]) {
          setOptions(true);
          return;
        }
        setPermission(map[command.argument]);
        setText('');
        return;
      }
      const prompt = commandPrompt(command.name, command.argument, agent);
      if (command.name === 'debug' && !command.argument) {
        toast.info('Describe the problem after /debug.');
        return;
      }
      if (prompt) {
        message = prompt;
        if (['plan', 'review', 'security-review'].includes(command.name))
          runPermission = 'read_only';
      } else {
        if (command.name === 'stop') onStop();
        else if (command.name === 'help') {
          setText('/');
          return;
        } else if (command.name === 'status')
          toast.info(`${agent} · ${model || 'Default model'} · ${permission} · ${backend}`);
        else onCommand(command.name);
        setText('');
        return;
      }
    }
    if (
      await onSend(message, {
        agent,
        permission: runPermission,
        execution_backend: backend,
        model: model || null,
        reasoning: reasoning || null,
        repo_ids: repos,
        task_budget: budget,
        local_provider: chosenModel?.local_provider,
        local_base_url: chosenModel?.local_base_url,
      })
    )
      setText('');
  };
  const suggestions = /^\/[a-z-]*$/.test(text)
    ? slashCommands.filter(([name]) => name.startsWith(text.slice(1)))
    : [];
  return (
    <>
      {suggestions.length > 0 && (
        <div className="mb-2 max-h-48 overflow-auto rounded-xl border border-line bg-elevated p-2">
          {suggestions.map(([name, description]) => (
            <button
              key={name}
              onClick={() => {
                setText(`/${name} `);
                input.current?.focus();
              }}
              className="flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left text-xs hover:bg-hover"
            >
              <span className="w-24 font-medium">/{name}</span>
              <span className="text-muted">{description}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-[20px] border border-line bg-elevated shadow-[0_8px_35px_-20px_#0008] focus-within:border-muted/60">
        <textarea
          ref={input}
          aria-label="Message"
          value={text}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            running
              ? 'Add a follow-up. It will join the queue…'
              : 'Describe what you want to work on…'
          }
          className="block max-h-60 min-h-[110px] w-full resize-y bg-transparent px-5 pb-2 pt-5 text-[15px] leading-6 placeholder:text-muted/75"
        />
        <div className="flex flex-wrap items-center gap-1 px-3 pb-3">
          <Button title="Task settings" onClick={() => setOptions(true)} className="h-8 w-8 p-0">
            <Plus size={20} />
          </Button>
          <div className="h-4 w-px bg-line mx-1" />
          <button
            onClick={() => setOptions(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-hover"
          >
            <ProviderLogo agent={agent} size={17} />
            {chosenModel?.label || (agent === 'codex' ? 'Codex' : 'Claude Code')}
            <ChevronDown size={12} className="text-muted" />
          </button>
          <Button onClick={() => setOptions(true)} className="text-xs">
            <FolderGit2 size={14} />
            {repos.length
              ? `${repos.length} ${repos.length === 1 ? 'project' : 'projects'}`
              : thread
                ? 'Workspace'
                : 'Add project'}
          </Button>
          <span className="flex-1" />
          {running && (
            <Button title="Stop task" onClick={onStop} className="h-8 w-8 p-0">
              <Square size={14} fill="currentColor" />
            </Button>
          )}
          <button
            aria-label={running ? 'Queue message' : 'Send message'}
            onClick={() => void send()}
            disabled={!text.trim() || busy}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-surface transition-opacity disabled:opacity-25"
          >
            <ArrowUp size={19} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-2 text-[11px] text-muted/80">
        <button
          onClick={() => setOptions(true)}
          className="flex items-center gap-1.5 hover:text-ink"
        >
          <ShieldCheck size={12} />
          {permission === 'autonomous'
            ? 'Full access'
            : permission === 'read_only'
              ? 'Read only'
              : 'Workspace access'}
          <ChevronDown size={10} />
        </button>
        <span>
          {budget.mode !== 'unlimited'
            ? budget.mode === 'tokens'
              ? `${budget.limit_tokens.toLocaleString()} token budget`
              : `${budget.limit_percent}% weekly budget`
            : 'Enter to send · Shift Enter for a new line'}
        </span>
      </div>
      <Modal
        open={options}
        onOpenChange={setOptions}
        title="Task settings"
        description="Choose how this task runs. Your agent works in an isolated workspace."
      >
        <div className="space-y-5">
          <label className="grid gap-2 text-sm">
            Agent
            <Select
              value={agent}
              onChange={(e) => {
                setAgent(e.target.value as AgentKind);
                setModel('');
                setReasoning('');
                if (e.target.value === 'claude_code' && budget.mode === 'weekly_percent')
                  setBudget({ mode: 'unlimited' });
              }}
            >
              <option value="codex">OpenAI Codex</option>
              <option value="claude_code">Claude Code</option>
            </Select>
          </label>
          <label className="grid gap-2 text-sm">
            Model
            <Select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setReasoning('');
              }}
            >
              <option value="">Provider default</option>
              {catalog?.models
                .filter((m) => m.available)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </Select>
          </label>
          {!!efforts.length && (
            <label className="grid gap-2 text-sm">
              Reasoning effort
              <Select value={reasoning} onChange={(e) => setReasoning(e.target.value)}>
                <option value="">Default</option>
                {efforts.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm">
              Permissions
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as PermissionPolicy)}
              >
                <option value="read_only">Read only</option>
                <option value="workspace_write">Workspace write</option>
                <option value="autonomous">Full access</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">
              Environment
              <Select
                value={backend}
                onChange={(e) => setBackend(e.target.value as ExecutionBackend)}
              >
                <option value="host">Local machine</option>
                <option value="docker_sandbox" disabled={agent !== 'codex'}>
                  Docker Sandbox
                </option>
              </Select>
            </label>
          </div>
          <fieldset disabled={!!running}>
            <legend className="mb-2 text-sm">Projects</legend>
            {store.repos.length ? (
              store.repos.map((r) => (
                <label key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={repos.includes(r.id)}
                    onChange={(e) =>
                      setRepos((old) =>
                        e.target.checked ? [...old, r.id] : old.filter((id) => id !== r.id),
                      )
                    }
                  />
                  {r.name}
                </label>
              ))
            ) : (
              <p className="text-xs text-muted">Add a repository from Projects in the sidebar.</p>
            )}
          </fieldset>
          <label className="grid gap-2 text-sm">
            Task budget
            <Select
              value={budget.mode}
              onChange={(e) =>
                setBudget(
                  e.target.value === 'tokens'
                    ? { mode: 'tokens', limit_tokens: 100000 }
                    : e.target.value === 'weekly_percent'
                      ? { mode: 'weekly_percent', limit_percent: 5 }
                      : { mode: 'unlimited' },
                )
              }
            >
              <option value="unlimited">No limit</option>
              <option value="tokens">Token target</option>
              <option value="weekly_percent" disabled={agent !== 'codex'}>
                Weekly percentage (Codex)
              </option>
            </Select>
          </label>
          {budget.mode !== 'unlimited' && (
            <input
              aria-label="Budget value"
              type="number"
              min={budget.mode === 'tokens' ? 10000 : 1}
              max={budget.mode === 'weekly_percent' ? 100 : undefined}
              value={budget.mode === 'tokens' ? budget.limit_tokens : budget.limit_percent}
              onChange={(e) =>
                setBudget(
                  budget.mode === 'tokens'
                    ? {
                        mode: 'tokens',
                        limit_tokens: Math.min(
                          10000000,
                          Math.max(10000, Math.round(+e.target.value)),
                        ),
                      }
                    : {
                        mode: 'weekly_percent',
                        limit_percent: Math.min(100, Math.max(1, Math.round(+e.target.value))),
                      },
                )
              }
            />
          )}
          <Button
            variant="solid"
            className="w-full"
            onClick={() =>
              void action(async () => {
                if (thread && !running) {
                  await rpc('assign_thread_repos', { thread_id: thread.id, repo_ids: repos });
                  await store.refresh();
                }
                setOptions(false);
              })
            }
          >
            Done
          </Button>
        </div>
      </Modal>
    </>
  );
}
