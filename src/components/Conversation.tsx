import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GitCompare,
  Cloud,
  MoreHorizontal,
  Trash2,
  Pencil,
  Copy,
  Check,
  Terminal,
  ShieldAlert,
  FileDiff,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  Clock,
  ListOrdered,
  CircleX,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Queue } from './Queue';
import { Questions } from './Questions';
import { Review } from './Review';
import { Composer, type RunOptions } from './Composer';
import { questionsFromEvent } from '../lib/userQuestions';
import { activeAccount, useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import { buildTranscriptItems, type TranscriptItem, type TransitionIcon } from '../lib/transcript';
import {
  INSTALL_URLS,
  PROVIDERS,
  accountName,
  agentName,
  errorMessage,
  providerName,
  resetTime,
  shellCommand,
  statusInfo,
} from '../lib/format';
import type {
  AgentKind,
  AgentThread,
  AgentThreadEvent,
  AgentTurn,
  QueuedTurn,
  CloudRun,
  ActivityEvent,
  ApprovalRequest,
} from '../lib/types';
import {
  Button,
  Confirm,
  Dot,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  Modal,
  PerpetualMark,
  ProviderLogo,
  Tip,
  cn,
} from './ui';

const LIVE = ['running', 'running_in_cloud', 'awaiting_approval', 'queued'];

export function Conversation({
  thread,
  onSelect,
  onNavigate,
}: {
  thread?: AgentThread;
  onNavigate: (page: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ text: '', seq: 0 });
  const fill = (text: string) => setDraft((old) => ({ text, seq: old.seq + 1 }));
  const [events, setEvents] = useState<AgentThreadEvent[]>([]);
  const [queued, setQueued] = useState<QueuedTurn[]>([]);
  const [cloudRuns, setCloudRuns] = useState<CloudRun[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [turnAgents, setTurnAgents] = useState<Record<string, AgentKind>>({});
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    if (!thread) return;
    let live = true;
    Promise.all([
      rpc<AgentThreadEvent[]>('list_thread_events', { thread_id: thread.id }),
      rpc<QueuedTurn[]>('list_queued_turns', { thread_id: thread.id }),
      rpc<CloudRun[]>('list_cloud_runs', { thread_id: thread.id }),
      rpc<ActivityEvent[]>('list_activity', { project_id: thread.project_id, limit: 200 }),
      rpc<AgentTurn[]>('list_thread_turns', { thread_id: thread.id }),
    ])
      .then(([e, q, c, a, turns]) => {
        if (!live) return;
        setEvents(e);
        setTurnAgents(Object.fromEntries(turns.map((turn) => [turn.id, turn.agent_kind])));
        setQueued(q);
        setCloudRuns(c);
        setActivities(
          a.filter(
            (event) =>
              event.task_id === thread.id || JSON.stringify(event.payload).includes(thread.id),
          ),
        );
        setLoaded(true);
      })
      .catch((err) => live && toast.error(errorMessage(err)));
    return () => {
      live = false;
    };
  }, [thread?.id, store.revision]);

  // Stream new and growing messages in as they happen.
  useEffect(() => {
    if (!thread) return;
    return store.onThreadEvent((event) => {
      if (event.thread_id !== thread.id) return;
      setEvents((old) => {
        const index = old.findIndex((e) => e.id === event.id);
        if (index < 0) return [...old, event];
        const next = [...old];
        next[index] = event;
        return next;
      });
    });
  }, [thread?.id, store.onThreadEvent]);

  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: 'end' });
  }, [events, queued, activities, store.approvals]);

  const send = async (message: string, options: RunOptions) => {
    setBusy(true);
    stick.current = true;
    try {
      let current = thread;
      if (!current) {
        current = await rpc<AgentThread>('create_agent_thread', {
          ...options,
          project_id: store.project?.id,
          title: message.split('\n')[0].slice(0, 80),
          objective: message,
          preferred_agent: options.agent,
          force_managed_workspace: true,
        });
      } else {
        await rpc('update_agent_thread', {
          id: current.id,
          patch: {
            model: options.model,
            reasoning: options.reasoning,
            permission: options.permission,
            execution_backend: options.execution_backend,
            task_budget: options.task_budget,
            local_provider: options.local_provider || null,
            local_base_url: options.local_base_url || null,
          },
        });
      }
      try {
        await rpc('send_thread_message', {
          thread_id: current.id,
          agent: options.agent,
          permission: options.permission,
          message,
          client_message_id: crypto.randomUUID(),
        });
      } finally {
        await store.refresh();
        if (!thread) onSelect(current.id);
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const accountLabel = (id: string) => {
    const account = store.accounts.find((a) => a.id === id);
    return account ? accountName(account) : null;
  };
  const items = useMemo(
    () =>
      buildTranscriptItems({
        thread: thread || null,
        events,
        activities,
        queued: [],
        cloudRuns,
        accountLabel,
      }),
    [thread, events, activities, cloudRuns, store.accounts],
  );
  const approvals = store.approvals.filter((a) => a.thread_id && a.thread_id === thread?.id);
  const composer = (
    <Composer
      draft={draft}
      hero={!thread}
      onCommand={(name) => {
        if (name === 'diff') setReview(true);
        else if (name === 'new') onSelect(null);
        else onNavigate(name === 'resume' ? 'search' : name);
      }}
      onNavigate={onNavigate}
      thread={thread}
      busy={busy}
      onSend={send}
      onStop={() =>
        void action(async () => {
          await rpc('stop_agent_thread', { thread_id: thread?.id });
          await store.refresh();
        })
      }
    />
  );

  if (!thread)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-6 py-10">
          <div className="mb-7 flex flex-col items-center text-center">
            <PerpetualMark size={30} />
            <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.03em]">
              What should we work on?
            </h1>
          </div>
          <SetupNotice onNavigate={onNavigate} />
          {composer}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              ['Plan a change', '/plan '],
              ['Review my changes', '/review '],
              [
                'Explain this project',
                'Explain how this project is structured and how its main parts fit together.',
              ],
              ['Fix a bug', '/debug '],
            ].map(([label, text]) => (
              <button
                key={label}
                onClick={() => fill(text)}
                className="h-8 rounded-full border border-line px-3.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  const running = LIVE.includes(thread.status);
  const lastGroupOpen = running;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ThreadBar
          thread={thread}
          cloudRuns={cloudRuns}
          review={review}
          onReview={() => setReview((v) => !v)}
          onDeleted={() => onSelect(null)}
        />
        <div
          ref={scroller}
          onScroll={() => {
            const e = scroller.current!;
            stick.current = e.scrollHeight - e.scrollTop - e.clientHeight < 120;
          }}
          className="min-h-0 flex-1 overflow-y-auto px-6"
        >
          <div className="mx-auto max-w-[760px] pt-6 pb-6">
            <Transcript
              items={items}
              agentFor={(event) =>
                turnAgents[event.turn_id] ||
                thread.active_agent ||
                thread.preferred_agent ||
                'codex'
              }
              openLast={lastGroupOpen}
              onEdit={fill}
              onAnswer={async (text) => {
                await rpc('send_thread_message', {
                  thread_id: thread.id,
                  agent: thread.active_agent || thread.preferred_agent || 'codex',
                  permission: thread.permission,
                  message: text,
                  client_message_id: crypto.randomUUID(),
                });
                await store.refresh();
              }}
            />
            {loaded && !items.length && (
              <p className="py-16 text-center text-[13px] text-muted">
                {thread.status === 'draft' ? 'Send a message to start.' : 'Starting…'}
              </p>
            )}
            {running && items.length > 0 && <Working thread={thread} />}
            <div ref={bottom} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[808px] shrink-0 px-6 pt-2 pb-4">
          {approvals.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
          <Queue turns={queued} refresh={store.refresh} />
          {composer}
        </div>
      </div>
      {review && <Review thread={thread} onClose={() => setReview(false)} />}
    </div>
  );
}

/** Explains, once, what's missing before a first task can run. */
function SetupNotice({ onNavigate }: { onNavigate: (page: string) => void }) {
  const store = useStore();
  if (!native || store.loading || !store.agents.length) return null;
  if (PROVIDERS.some((agent) => activeAccount(store.accounts, agent))) return null;
  const installed = PROVIDERS.filter(
    (agent) => store.agents.find((a) => a.kind === agent)?.installed,
  );
  return (
    <div className="mb-4 rounded-xl border border-line bg-elevated/50 px-4 py-3.5">
      <div className="text-[13px] font-medium">
        {installed.length ? 'Sign in to start' : 'Install Codex or Claude Code to start'}
      </div>
      <p className="mt-0.5 text-xs leading-5 text-muted">
        {installed.length
          ? 'Perpetual runs tasks with your Codex or Claude subscription.'
          : 'Perpetual runs tasks through the Codex or Claude Code command-line tools.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROVIDERS.map((agent) =>
          installed.includes(agent) ? (
            <Button
              key={agent}
              size="sm"
              variant="secondary"
              onClick={() => void store.signIn({ agent })}
            >
              <ProviderLogo agent={agent} size={13} />
              Sign in to {agentName(agent)}
            </Button>
          ) : (
            <Button
              key={agent}
              size="sm"
              variant="secondary"
              onClick={() => void action(() => openUrl(INSTALL_URLS[agent]))}
            >
              <ProviderLogo agent={agent} size={13} />
              Get {providerName(agent)}
              <ExternalLink size={11} />
            </Button>
          ),
        )}
        <Button size="sm" onClick={() => onNavigate('accounts')}>
          Manage accounts
        </Button>
      </div>
    </div>
  );
}

function ThreadBar({
  thread,
  cloudRuns,
  review,
  onReview,
  onDeleted,
}: {
  thread: AgentThread;
  cloudRuns: CloudRun[];
  review: boolean;
  onReview: () => void;
  onDeleted: () => void;
}) {
  const store = useStore();
  const [rename, setRename] = useState(false);
  const [remove, setRemove] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const status = statusInfo(thread.status);
  const running = LIVE.includes(thread.status);
  const agent = thread.active_agent || thread.preferred_agent;
  const account = store.accounts.find((a) => a.id === thread.provider_account_id);
  const activeCloud = cloudRuns.some((r) =>
    ['provisioning', 'running', 'stalled'].includes(r.status),
  );
  const [cloudEnabled, setCloudEnabled] = useState(false);
  useEffect(() => {
    if (native)
      rpc<{ enabled: boolean }>('get_cloud_policy')
        .then((policy) => setCloudEnabled(policy.enabled))
        .catch(() => setCloudEnabled(false));
  }, []);
  return (
    <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line/40 px-4 text-xs">
      <span className="flex items-center gap-2 text-muted">
        <Dot tone={status.tone} live={status.live} />
        {status.label}
        {thread.status === 'waiting_for_limit' && thread.limit_reset_at && (
          <span className="text-faint">· until {resetTime(thread.limit_reset_at)}</span>
        )}
      </span>
      {agent && (
        <span className="flex min-w-0 items-center gap-1.5 text-faint">
          <span className="text-line">|</span>
          <ProviderLogo agent={agent} size={12} />
          <span className="truncate">{account ? accountName(account) : agentName(agent)}</span>
        </span>
      )}
      <span className="flex-1" />
      <Button size="sm" onClick={onReview} className={cn(review && 'bg-hover text-ink')}>
        <GitCompare size={13} />
        Changes
      </Button>
      <MenuRoot>
        <MenuTrigger asChild>
          <button
            aria-label="Task actions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover"
          >
            <MoreHorizontal size={16} />
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-52">
          <MenuItem
            onSelect={() => {
              setTitle(thread.title);
              setRename(true);
            }}
          >
            <Pencil size={14} className="text-muted" />
            Rename
          </MenuItem>
          {activeCloud ? (
            <MenuItem
              onSelect={() =>
                void action(async () => {
                  await rpc('reclaim_cloud_run', { thread_id: thread.id });
                  await store.refresh();
                }, 'Brought back to this computer')
              }
            >
              <Cloud size={14} className="text-muted" />
              Bring back from cloud
            </MenuItem>
          ) : (
            cloudEnabled && (
              <MenuItem
                disabled={running}
                onSelect={() =>
                  void action(async () => {
                    await rpc('launch_cloud_handoff', { thread_id: thread.id, agent: null });
                    await store.refresh();
                  }, 'Continuing in the cloud')
                }
              >
                <Cloud size={14} className="text-muted" />
                Continue in cloud
              </MenuItem>
            )
          )}
          <MenuSeparator />
          <MenuItem danger onSelect={() => setRemove(true)}>
            <Trash2 size={14} />
            Delete
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <Modal
        open={rename}
        onOpenChange={setRename}
        title="Rename task"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRename(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={() =>
                void action(async () => {
                  await rpc('update_agent_thread', {
                    id: thread.id,
                    patch: { title: title.trim() },
                  });
                  await store.refresh();
                  setRename(false);
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void action(async () => {
              await rpc('update_agent_thread', { id: thread.id, patch: { title: title.trim() } });
              await store.refresh();
              setRename(false);
            });
          }}
        >
          <input
            autoFocus
            aria-label="Task name"
            className="w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>
      </Modal>
      <Confirm
        open={remove}
        onOpenChange={setRemove}
        title="Delete this task?"
        description={
          running
            ? 'This task is still running. Deleting it stops the task and removes its conversation.'
            : 'Its conversation and history will be deleted. Changes already applied to your projects stay.'
        }
        confirmLabel={running ? 'Stop and delete' : 'Delete'}
        danger
        onConfirm={() =>
          action(async () => {
            await rpc('delete_agent_thread', { id: thread.id, force: running });
            onDeleted();
            await store.refresh();
          })
        }
      />
    </div>
  );
}

function Working({ thread }: { thread: AgentThread }) {
  const label =
    thread.status === 'awaiting_approval'
      ? 'Waiting for your approval'
      : thread.status === 'queued'
        ? 'Waiting to start'
        : thread.status === 'running_in_cloud'
          ? 'Working in the cloud'
          : 'Working';
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

type Block =
  | { kind: 'item'; item: TranscriptItem }
  | { kind: 'steps'; id: string; events: AgentThreadEvent[] };

const isStep = (event: AgentThreadEvent) =>
  event.role === 'tool' || event.kind.includes('tool') || event.kind === 'file_changed';

/** Groups consecutive tool calls and file edits into one collapsible block. */
function toBlocks(items: TranscriptItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    if (item.type === 'event' && isStep(item.event) && !questionsFromEvent(item.event).length) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'steps') last.events.push(item.event);
      else blocks.push({ kind: 'steps', id: item.event.id, events: [item.event] });
    } else blocks.push({ kind: 'item', item });
  }
  return blocks;
}

function Transcript({
  items,
  agentFor,
  openLast,
  onEdit,
  onAnswer,
}: {
  items: TranscriptItem[];
  agentFor: (event: AgentThreadEvent) => AgentKind;
  openLast: boolean;
  onEdit: (text: string) => void;
  onAnswer: (text: string) => Promise<void>;
}) {
  const blocks = toBlocks(items);
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === 'steps' ? (
          <Steps
            key={block.id}
            events={block.events}
            defaultOpen={openLast && index === blocks.length - 1}
          />
        ) : block.item.type === 'event' ? (
          <EventMessage
            key={block.item.event.id}
            event={block.item.event}
            agent={agentFor(block.item.event)}
            onEdit={onEdit}
            onAnswer={onAnswer}
          />
        ) : block.item.type === 'transition' ? (
          <Transition key={block.item.id} item={block.item} />
        ) : null,
      )}
    </>
  );
}

const TRANSITION_ICONS: Record<TransitionIcon, typeof Clock> = {
  clock: Clock,
  refresh: RefreshCw,
  alert: CircleAlert,
  queue: ListOrdered,
  cloud: Cloud,
  terminal: Terminal,
};

function Transition({ item }: { item: Extract<TranscriptItem, { type: 'transition' }> }) {
  const Icon = TRANSITION_ICONS[item.icon ?? 'refresh'];
  return (
    <div className="my-5 flex items-start justify-center gap-2 text-center text-xs">
      <Icon
        size={13}
        className={cn(
          'mt-0.5 shrink-0',
          item.tone === 'danger'
            ? 'text-danger'
            : item.tone === 'warning'
              ? 'text-warning'
              : 'text-muted',
        )}
      />
      <span className="text-muted">
        {item.text}
        {item.detail && <span className="text-faint"> · {item.detail}</span>}
      </span>
    </div>
  );
}

function stepSummary(event: AgentThreadEvent): {
  label: string;
  detail: string | null;
  failed?: boolean;
} {
  const data = (event.data ?? {}) as Record<string, unknown>;
  if (event.kind === 'file_changed') return { label: event.text || 'Changed a file', detail: null };
  if (event.kind === 'tool_result') {
    const ok = data.ok !== false;
    const text = String(data.summary ?? event.text ?? '').trim();
    return { label: ok ? 'Result' : 'Failed', detail: text || null, failed: !ok };
  }
  const input = (data.input ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(input.command)
    ? input.command.join(' ')
    : typeof input.command === 'string'
      ? input.command
      : null;
  const command = raw ? shellCommand(raw) : null;
  const target =
    command ??
    ['file_path', 'path', 'pattern', 'url', 'query', 'description']
      .map((k) => input[k])
      .find((v): v is string => typeof v === 'string' && !!v.trim()) ??
    null;
  return { label: event.text || 'Tool', detail: target };
}

function Steps({ events, defaultOpen }: { events: AgentThreadEvent[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  const calls = events.filter((e) => e.kind !== 'tool_result');
  const files = events.filter((e) => e.kind === 'file_changed').length;
  const failed = events.some(
    (e) => e.kind === 'tool_result' && (e.data as { ok?: boolean })?.ok === false,
  );
  const parts = [
    calls.length - files > 0 &&
      `${calls.length - files} ${calls.length - files === 1 ? 'step' : 'steps'}`,
    files > 0 && `${files} ${files === 1 ? 'file' : 'files'} changed`,
  ].filter(Boolean);
  const last = calls[calls.length - 1];
  return (
    <div className="my-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-1.5 rounded-md py-1 text-xs text-muted hover:text-ink"
      >
        <ChevronRight
          size={13}
          className={cn('shrink-0 transition-transform', open && 'rotate-90')}
        />
        <Wrench size={12} className="shrink-0" />
        <span className="shrink-0">{parts.join(', ') || 'Worked'}</span>
        {failed && <CircleX size={12} className="shrink-0 text-danger" />}
        {!open && last && (
          <span className="truncate text-faint">
            · {stepSummary(last).detail || stepSummary(last).label}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 ml-[7px] space-y-0.5 border-l border-line pl-4">
          {events.map((event) => (
            <Step key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function Step({ event }: { event: AgentThreadEvent }) {
  const [open, setOpen] = useState(false);
  const { label, detail, failed } = stepSummary(event);
  const isFile = event.kind === 'file_changed';
  const isResult = event.kind === 'tool_result';
  const full = isResult
    ? detail
    : JSON.stringify((event.data as { input?: unknown })?.input ?? event.data, null, 2);
  const expandable = !isFile && !!full && full !== '{}' && full !== 'null';
  return (
    <div className="text-xs">
      <button
        disabled={!expandable}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-2 rounded py-1 text-left text-muted enabled:hover:text-ink"
      >
        {isFile ? (
          <FileDiff size={12} className="shrink-0" />
        ) : isResult ? (
          failed ? (
            <CircleX size={12} className="shrink-0 text-danger" />
          ) : (
            <Check size={12} className="shrink-0 text-success" />
          )
        ) : (
          <Terminal size={12} className="shrink-0" />
        )}
        <span className={cn('shrink-0', !isResult && 'text-ink/85')}>
          {isResult ? (failed ? 'Failed' : 'Done') : label}
        </span>
        {detail && (
          <span className="truncate font-mono text-[11px] text-faint">{detail.split('\n')[0]}</span>
        )}
      </button>
      {open && full && (
        <pre className="mt-1 mb-2 max-h-72 overflow-auto rounded-lg border border-line bg-sidebar p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-muted">
          {full}
        </pre>
      )}
    </div>
  );
}

function EventMessage({
  event,
  agent,
  onEdit,
  onAnswer,
}: {
  event: AgentThreadEvent;
  agent: AgentKind;
  onEdit: (text: string) => void;
  onAnswer: (text: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  if (questionsFromEvent(event).length) return <Questions event={event} onAnswer={onAnswer} />;
  if (event.kind === 'error')
    return (
      <div className="my-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px]">
        <CircleAlert size={15} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 break-words selectable">{event.text}</div>
      </div>
    );
  if (!event.text?.trim()) return null;
  const streaming = (event.data as { streaming?: boolean } | null)?.streaming === true;
  const copy = () =>
    void action(async () => {
      await navigator.clipboard.writeText(event.text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  if (event.role === 'user')
    return (
      <article className="group mt-6 mb-6 flex flex-col items-end first:mt-0">
        <div className="max-w-[85%] rounded-2xl bg-hover px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap break-words selectable">
          {event.text}
        </div>
        <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <MessageAction label={copied ? 'Copied' : 'Copy'} onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </MessageAction>
          <MessageAction label="Edit as new message" onClick={() => onEdit(event.text || '')}>
            <Pencil size={13} />
          </MessageAction>
        </div>
      </article>
    );
  return (
    <article className="group my-4">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted">
        <ProviderLogo agent={agent} size={14} />
        {agentName(agent)}
      </div>
      <div className="prose-chat">
        <Markdown remarkPlugins={[remarkGfm]}>{event.text || ''}</Markdown>
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-muted align-text-bottom" />
        )}
      </div>
      {!streaming && (
        <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <MessageAction label={copied ? 'Copied' : 'Copy'} onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </MessageAction>
        </div>
      )}
    </article>
  );
}

function MessageAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <button
        aria-label={label}
        onClick={onClick}
        className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
      >
        {children}
      </button>
    </Tip>
  );
}

function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const store = useStore();
  const [pending, setPending] = useState<string | null>(null);
  const decide = (decision: 'allow' | 'allow_for_session' | 'deny' | 'abort') =>
    void (async () => {
      setPending(decision);
      await action(async () => {
        await rpc('resolve_approval', { id: approval.id, decision });
        await store.refresh();
      });
      setPending(null);
    })();
  const detail =
    approval.command?.join(' ') ||
    (approval.input && typeof approval.input === 'object' && Object.keys(approval.input).length
      ? JSON.stringify(approval.input, null, 2)
      : null);
  const what =
    approval.kind === 'command'
      ? 'run a command'
      : approval.kind === 'file_change'
        ? 'change files'
        : `use ${approval.tool_name}`;
  return (
    <div className="mb-3 animate-pop-in rounded-2xl border border-warning/35 bg-elevated p-4 shadow-[0_8px_30px_-22px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <ShieldAlert size={15} className="text-warning" />
        {agentName(approval.agent)} wants to {what}
      </div>
      {detail && (
        <pre className="mt-2.5 max-h-40 overflow-auto rounded-lg bg-sidebar px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap break-all selectable">
          {detail}
        </pre>
      )}
      {approval.cwd && (
        <p className="mt-1.5 truncate font-mono text-[11px] text-faint">in {approval.cwd}</p>
      )}
      {approval.reason && <p className="mt-2 text-xs leading-5 text-muted">{approval.reason}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={pending === 'allow'}
          onClick={() => decide('allow')}
        >
          Allow
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={pending === 'allow_for_session'}
          onClick={() => decide('allow_for_session')}
        >
          Allow for this task
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={pending === 'deny'}
          onClick={() => decide('deny')}
        >
          Deny
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          loading={pending === 'abort'}
          onClick={() => decide('abort')}
        >
          Stop task
        </Button>
      </div>
    </div>
  );
}
