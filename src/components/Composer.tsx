import { toast } from 'sonner';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  FolderGit2,
  FolderOpen,
  Square,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { commandPrompt, parseCommand, slashCommands } from '../lib/commands';
import { activeAccount, useStore } from '../lib/store';
import { action, rpc } from '../lib/api';
import { PROVIDERS, accountName, accountState, providerName } from '../lib/format';
import type {
  AgentKind,
  AgentThread,
  AgentThreadRepo,
  ExecutionBackend,
  PermissionPolicy,
  TaskBudget,
} from '../lib/types';
import { AccountMenuContent } from './AccountSwitcher';
import { useAddFolder } from './AddFolder';
import {
  Button,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  Modal,
  ProviderLogo,
  Select,
  Tip,
  cn,
} from './ui';

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

const ACCESS: Record<PermissionPolicy, { label: string; detail: string }> = {
  read_only: { label: 'Read only', detail: 'Can read files but not change them' },
  workspace_write: { label: 'Workspace', detail: 'Can edit files in the task workspace' },
  autonomous: { label: 'Full access', detail: 'Can run any command without asking' },
};

const LAST_AGENT = 'composer.agent';
function initialAgent(thread?: AgentThread): AgentKind {
  if (thread?.active_agent) return thread.active_agent;
  try {
    const saved = localStorage.getItem(LAST_AGENT);
    if (saved === 'codex' || saved === 'claude_code') return saved;
  } catch {
    // Fall through to the default.
  }
  return 'codex';
}

export function Composer({
  thread,
  busy,
  onSend,
  onStop,
  draft,
  onCommand,
  onNavigate,
  hero,
}: {
  thread?: AgentThread;
  draft: { text: string; seq: number };
  onCommand: (name: string) => void;
  onNavigate: (page: string) => void;
  busy: boolean;
  onSend: (message: string, options: RunOptions) => Promise<boolean>;
  onStop: () => void;
  /** The larger, centered composer used to start a task. */
  hero?: boolean;
}) {
  const store = useStore();
  const folder = useAddFolder();
  const [text, setText] = useState('');
  const [agent, setAgent] = useState<AgentKind>(() => initialAgent(thread));
  const [model, setModel] = useState(thread?.model || '');
  const [reasoning, setReasoning] = useState(thread?.reasoning || '');
  const [permission, setPermission] = useState<PermissionPolicy>(
    thread?.permission || 'workspace_write',
  );
  const [backend, setBackend] = useState<ExecutionBackend>(thread?.execution_backend || 'host');
  const [repos, setRepos] = useState<string[]>([]);
  const [budget, setBudget] = useState<TaskBudget>(thread?.task_budget || { mode: 'unlimited' });
  const [options, setOptions] = useState(false);
  const [suggestion, setSuggestion] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);

  const catalog = store.models.find((m) => m.agent === agent);
  const models = catalog?.models.filter((m) => m.available || m.id === model) ?? [];
  const chosenModel = catalog?.models.find((m) => m.id === model);
  const efforts = chosenModel?.reasoning || catalog?.reasoning || [];
  const running =
    !!thread &&
    ['running', 'running_in_cloud', 'awaiting_approval', 'queued'].includes(thread.status);
  const account = activeAccount(store.accounts, agent);
  // A new task starts on a provider that can run it, unless the person picks one.
  const picked = useRef(!!thread);
  useEffect(() => {
    if (picked.current || !store.accounts.length) return;
    picked.current = true;
    const other = PROVIDERS.find((p) => p !== agent);
    if (!account && other && activeAccount(store.accounts, other)) setAgent(other);
  }, [store.accounts]);
  const providerAccounts = store.accounts.filter((a) => a.agent === agent);
  const managed = providerAccounts.length > 0;
  const allLimited =
    managed && !account && providerAccounts.some((a) => accountState(a) === 'limited');

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
  }, [thread?.active_agent, thread?.model, thread?.reasoning]);
  useEffect(() => {
    if (!thread) return;
    void action(async () => {
      const links = await rpc<AgentThreadRepo[]>('list_thread_repos', { thread_id: thread.id });
      setRepos(links.map((link) => link.repo_id));
    });
  }, [thread?.id]);
  // Grow with the text, up to a comfortable limit.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [text]);

  const chooseAgent = (next: AgentKind) => {
    picked.current = true;
    setAgent(next);
    setModel('');
    setReasoning('');
    if (next === 'claude_code') {
      if (budget.mode === 'weekly_percent') setBudget({ mode: 'unlimited' });
      if (backend === 'docker_sandbox') setBackend('host');
    }
    try {
      localStorage.setItem(LAST_AGENT, next);
    } catch {
      // Not persisted; the choice still applies to this task.
    }
  };
  const chooseRepos = (next: string[]) => {
    setRepos(next);
    if (thread && !running)
      void action(async () => {
        await rpc('assign_thread_repos', { thread_id: thread.id, repo_ids: next });
      });
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    let message = text.trim();
    let runPermission = permission;
    const command = parseCommand(message);
    if (command) {
      if (command.name === 'model') {
        const match = models.find(
          (m) =>
            m.id.toLowerCase() === command.argument.toLowerCase() ||
            m.label.toLowerCase() === command.argument.toLowerCase() ||
            m.aliases.includes(command.argument.toLowerCase()),
        );
        if (!match) {
          toast.info(
            command.argument
              ? `No model named "${command.argument}".`
              : 'Choose a model from the model menu.',
          );
          return;
        }
        setModel(match.id);
        setReasoning('');
        setText('');
        toast.success(`Model set to ${match.label}`);
        return;
      }
      if (command.name === 'effort') {
        if (!efforts.includes(command.argument)) {
          toast.info(
            efforts.length
              ? `Choose one of: ${efforts.join(', ')}.`
              : 'This model has no reasoning levels.',
          );
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
          workspace: 'workspace_write',
          workspace_write: 'workspace_write',
          'workspace-write': 'workspace_write',
          full: 'autonomous',
          autonomous: 'autonomous',
          'full-access': 'autonomous',
        };
        if (!map[command.argument]) {
          toast.info('Use read-only, workspace, or full-access.');
          return;
        }
        setPermission(map[command.argument]);
        setText('');
        return;
      }
      if (command.name === 'debug' && !command.argument) {
        toast.info('Describe the problem after /debug.');
        return;
      }
      const prompt = commandPrompt(command.name, command.argument, agent);
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
          toast.info(
            `${providerName(agent)} · ${chosenModel?.label || 'Default model'} · ${ACCESS[permission].label}${account ? ` · ${accountName(account)}` : ''}`,
          );
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
  useEffect(() => setSuggestion(0), [text]);
  const complete = (name: string) => {
    setText(`/${name} `);
    input.current?.focus();
  };

  const repoLabel = repos.length
    ? repos.length === 1
      ? (store.repos.find((r) => r.id === repos[0])?.name ?? '1 folder')
      : `${repos.length} projects`
    : 'No folder';

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <div
          role="listbox"
          className={cn(
            'absolute right-0 left-0 z-20 max-h-64 overflow-y-auto rounded-xl border border-line bg-elevated p-1 shadow-xl',
            hero ? 'top-full mt-2' : 'bottom-full mb-2',
          )}
        >
          {suggestions.map(([name, description], index) => (
            <button
              key={name}
              role="option"
              aria-selected={index === suggestion}
              onMouseEnter={() => setSuggestion(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                complete(name);
              }}
              className={cn(
                'flex w-full items-center gap-4 rounded-lg px-3 py-1.5 text-left text-[13px]',
                index === suggestion && 'bg-hover',
              )}
            >
              <span className="w-32 shrink-0 font-medium">/{name}</span>
              <span className="truncate text-muted">{description}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          'rounded-2xl border border-line bg-elevated transition-colors focus-within:border-muted/50',
          hero
            ? 'shadow-[0_12px_40px_-24px_rgba(0,0,0,0.5)]'
            : 'shadow-[0_8px_30px_-22px_rgba(0,0,0,0.5)]',
        )}
      >
        <textarea
          ref={input}
          aria-label="Message"
          value={text}
          rows={hero ? 3 : 1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestion(
                  (i) =>
                    (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                    suggestions.length,
                );
                return;
              }
              if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                const [name] = suggestions[suggestion];
                if (`/${name}` !== text.trim() || e.key === 'Tab') {
                  e.preventDefault();
                  complete(name);
                  return;
                }
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setText('');
                return;
              }
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            running
              ? 'Add a follow-up…'
              : thread
                ? 'Reply…'
                : 'Describe a task, or type / for commands'
          }
          className={cn(
            'block w-full resize-none bg-transparent px-4 text-[14px] leading-6 placeholder:text-faint',
            hero ? 'min-h-[88px] pt-4 pb-1' : 'min-h-[48px] pt-3 pb-1',
          )}
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          <MenuRoot>
            <MenuTrigger asChild>
              <button className="flex h-8 max-w-56 items-center gap-2 rounded-lg px-2 text-xs text-ink/90 hover:bg-hover data-[state=open]:bg-hover">
                <ProviderLogo agent={agent} size={15} />
                <span className="truncate">{chosenModel?.label || providerName(agent)}</span>
                {reasoning && <span className="text-muted capitalize">{reasoning}</span>}
                <ChevronDown size={12} className="shrink-0 text-muted" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" side={hero ? 'bottom' : 'top'} className="w-64">
              <MenuLabel>Agent</MenuLabel>
              <MenuRadioGroup value={agent} onValueChange={(v) => chooseAgent(v as AgentKind)}>
                {PROVIDERS.map((kind) => {
                  const ready = !!activeAccount(store.accounts, kind);
                  const known = store.accounts.some((a) => a.agent === kind);
                  return (
                    <MenuRadioItem key={kind} value={kind} disabled={running && kind !== agent}>
                      <ProviderLogo agent={kind} size={14} />
                      <span className="flex-1">{providerName(kind)}</span>
                      {known && !ready && (
                        <span className="text-[11px] text-faint">Unavailable</span>
                      )}
                    </MenuRadioItem>
                  );
                })}
              </MenuRadioGroup>
              <MenuSeparator />
              <MenuSub>
                <MenuSubTrigger>
                  <span className="flex-1">Model</span>
                  <span className="max-w-28 truncate text-xs text-muted">
                    {chosenModel?.label || 'Default'}
                  </span>
                </MenuSubTrigger>
                <MenuSubContent className="w-60">
                  <MenuRadioGroup
                    value={model}
                    onValueChange={(v) => {
                      setModel(v);
                      setReasoning('');
                    }}
                  >
                    <MenuRadioItem value="">Default</MenuRadioItem>
                    {models.map((m) => (
                      <MenuRadioItem key={m.id} value={m.id}>
                        <span className="truncate">{m.label}</span>
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuSubContent>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger disabled={!efforts.length}>
                  <span className="flex-1">Reasoning</span>
                  <span className="text-xs text-muted capitalize">{reasoning || 'Default'}</span>
                </MenuSubTrigger>
                <MenuSubContent className="w-44">
                  <MenuRadioGroup value={reasoning} onValueChange={setReasoning}>
                    <MenuRadioItem value="">Default</MenuRadioItem>
                    {efforts.map((r) => (
                      <MenuRadioItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuSubContent>
              </MenuSub>
            </MenuContent>
          </MenuRoot>

          <MenuRoot>
            <MenuTrigger asChild disabled={running}>
              <button className="flex h-8 max-w-44 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-hover hover:text-ink disabled:opacity-50 data-[state=open]:bg-hover">
                <FolderGit2 size={14} className="shrink-0" />
                <span className="truncate">{repoLabel}</span>
                <ChevronDown size={12} className="shrink-0" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" side={hero ? 'bottom' : 'top'} className="w-64">
              <MenuLabel>Folders this task works in</MenuLabel>
              {store.repos.map((repo) => (
                <MenuCheckboxItem
                  key={repo.id}
                  checked={repos.includes(repo.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) =>
                    chooseRepos(
                      checked ? [...repos, repo.id] : repos.filter((id) => id !== repo.id),
                    )
                  }
                >
                  <span className="truncate">{repo.name}</span>
                </MenuCheckboxItem>
              ))}
              {!store.repos.length && (
                <p className="px-2.5 pb-1.5 text-xs leading-5 text-muted">
                  Without a folder, the task starts in an empty workspace.
                </p>
              )}
              <MenuSeparator />
              <MenuItem
                onSelect={() =>
                  void folder.pick().then((repo) => {
                    if (repo && !repos.includes(repo.id)) chooseRepos([...repos, repo.id]);
                  })
                }
              >
                <FolderOpen size={14} className="text-muted" />
                Choose a folder…
              </MenuItem>
            </MenuContent>
          </MenuRoot>

          <MenuRoot>
            <MenuTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover">
                <ShieldCheck
                  size={14}
                  className={cn(permission === 'autonomous' && 'text-warning')}
                />
                <span className="hidden sm:inline">{ACCESS[permission].label}</span>
                <ChevronDown size={12} />
              </button>
            </MenuTrigger>
            <MenuContent align="start" side={hero ? 'bottom' : 'top'} className="w-72">
              <MenuLabel>Access</MenuLabel>
              <MenuRadioGroup
                value={permission}
                onValueChange={(v) => setPermission(v as PermissionPolicy)}
              >
                {(Object.keys(ACCESS) as PermissionPolicy[]).map((key) => (
                  <MenuRadioItem key={key} value={key} className="h-auto py-1.5">
                    <div>
                      <div>{ACCESS[key].label}</div>
                      <div className="text-[11px] text-muted">{ACCESS[key].detail}</div>
                    </div>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </MenuRoot>

          <Tip label="Task options">
            <button
              aria-label="Task options"
              onClick={() => setOptions(true)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink',
                (backend !== 'host' || budget.mode !== 'unlimited') && 'text-accent',
              )}
            >
              <SlidersHorizontal size={14} />
            </button>
          </Tip>

          <span className="flex-1" />
          {running && (
            <Tip label="Stop">
              <button
                aria-label="Stop"
                onClick={onStop}
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink hover:bg-hover"
              >
                <Square size={11} fill="currentColor" />
              </button>
            </Tip>
          )}
          <Tip label={running ? 'Queue follow-up (Enter)' : 'Send (Enter)'}>
            <button
              aria-label={running ? 'Queue follow-up' : 'Send'}
              onClick={() => void send()}
              disabled={!text.trim() || busy}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-surface transition-opacity hover:opacity-85 disabled:opacity-25"
            >
              <ArrowUp size={17} strokeWidth={2.25} />
            </button>
          </Tip>
        </div>
      </div>

      <div className="mt-2 flex min-h-5 items-center justify-between gap-3 px-1 text-xs">
        {managed ? (
          <MenuRoot>
            <MenuTrigger asChild>
              <button
                className={cn(
                  'flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-hover',
                  account ? 'text-faint hover:text-muted' : 'text-warning',
                )}
              >
                {!account && <TriangleAlert size={12} className="shrink-0" />}
                <span className="truncate">
                  {account
                    ? accountName(account)
                    : allLimited
                      ? `Every ${providerName(agent)} account is at its limit`
                      : `No ${providerName(agent)} account is signed in`}
                </span>
                <ChevronDown size={11} className="shrink-0" />
              </button>
            </MenuTrigger>
            <AccountMenuContent
              agents={[agent]}
              side={hero ? 'bottom' : 'top'}
              onManage={() => onNavigate('accounts')}
            />
          </MenuRoot>
        ) : (
          <span />
        )}
        {budget.mode !== 'unlimited' && (
          <span className="shrink-0 text-faint">
            {budget.mode === 'tokens'
              ? `${budget.limit_tokens.toLocaleString()}-token budget`
              : `${budget.limit_percent}% of weekly usage`}
          </span>
        )}
      </div>

      <Modal
        open={options}
        onOpenChange={setOptions}
        title="Task options"
        width={440}
        footer={
          <Button variant="primary" onClick={() => setOptions(false)}>
            Done
          </Button>
        }
      >
        <div className="grid gap-5">
          <label className="grid gap-1.5 text-[13px]">
            Run on
            <Select
              value={backend}
              disabled={running}
              onChange={(e) => setBackend(e.target.value as ExecutionBackend)}
            >
              <option value="host">This computer</option>
              <option value="docker_sandbox" disabled={agent !== 'codex'}>
                Docker Sandbox{agent !== 'codex' ? ' (Codex only)' : ''}
              </option>
            </Select>
          </label>
          <div className="grid gap-1.5 text-[13px]">
            Usage budget
            <div className="flex gap-2">
              <Select
                aria-label="Usage budget"
                className="flex-1"
                value={budget.mode}
                onChange={(e) =>
                  setBudget(
                    e.target.value === 'tokens'
                      ? { mode: 'tokens', limit_tokens: 200000 }
                      : e.target.value === 'weekly_percent'
                        ? { mode: 'weekly_percent', limit_percent: 5 }
                        : { mode: 'unlimited' },
                  )
                }
              >
                <option value="unlimited">No limit</option>
                <option value="tokens">Token budget</option>
                <option value="weekly_percent" disabled={agent !== 'codex'}>
                  Share of weekly usage{agent !== 'codex' ? ' (Codex only)' : ''}
                </option>
              </Select>
              {budget.mode !== 'unlimited' && (
                <input
                  aria-label="Budget amount"
                  type="number"
                  className="!w-32 text-right tabular-nums"
                  min={budget.mode === 'tokens' ? 10000 : 1}
                  max={budget.mode === 'tokens' ? 10000000 : 100}
                  step={budget.mode === 'tokens' ? 10000 : 1}
                  value={budget.mode === 'tokens' ? budget.limit_tokens : budget.limit_percent}
                  onChange={(e) =>
                    setBudget(
                      budget.mode === 'tokens'
                        ? {
                            mode: 'tokens',
                            limit_tokens: Math.min(
                              10000000,
                              Math.max(10000, Math.round(+e.target.value || 0)),
                            ),
                          }
                        : {
                            mode: 'weekly_percent',
                            limit_percent: Math.min(
                              100,
                              Math.max(1, Math.round(+e.target.value || 0)),
                            ),
                          },
                    )
                  }
                />
              )}
            </div>
            <span className="text-xs leading-5 text-muted">
              The task pauses at the end of the step that reaches the budget.
            </span>
          </div>
        </div>
      </Modal>
      {folder.dialog}
    </div>
  );
}
