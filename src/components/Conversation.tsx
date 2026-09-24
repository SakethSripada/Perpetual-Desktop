import { Queue } from './Queue';
import { Questions } from './Questions';
import { questionsFromEvent } from '../lib/userQuestions';
import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  FileSearch,
  GitPullRequest,
  ArrowRight,
  GitBranch,
  Cloud,
  MoreHorizontal,
  Trash2,
  Pencil,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useStore } from '../lib/store';
import { action, rpc } from '../lib/api';
import { buildTranscriptItems } from '../lib/transcript';
import type {
  AgentThread,
  AgentThreadEvent,
  QueuedTurn,
  CloudRun,
  ActivityEvent,
} from '../lib/types';
import { Button, PerpetualMark, ProviderLogo, Modal, cn } from './ui';
import { Composer, type RunOptions } from './Composer';
import { Review } from './Review';
export function Conversation({
  thread,
  onSelect,
  onAccounts,
  onNavigate,
}: {
  thread?: AgentThread;
  onNavigate: (page: string) => void;
  onSelect: (id: string) => void;
  onAccounts: () => void;
}) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ text: '', seq: 0 });
  const fill = (text: string) => setDraft((old) => ({ text, seq: old.seq + 1 }));
  const [events, setEvents] = useState<AgentThreadEvent[]>([]);
  const [queued, setQueued] = useState<QueuedTurn[]>([]);
  const [cloudRuns, setCloudRuns] = useState<CloudRun[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [review, setReview] = useState(false);
  const [remove, setRemove] = useState(false);
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState(thread?.title || '');
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    if (!thread) return;
    let live = true;
    void action(async () => {
      const [e, q, c, a] = await Promise.all([
        rpc<AgentThreadEvent[]>('list_thread_events', { thread_id: thread.id }),
        rpc<QueuedTurn[]>('list_queued_turns', { thread_id: thread.id }),
        rpc<CloudRun[]>('list_cloud_runs', { thread_id: thread.id }),
        rpc<ActivityEvent[]>('list_activity', { project_id: thread.project_id, limit: 200 }),
      ]);
      if (live) {
        setEvents(e);
        setQueued(q);
        setCloudRuns(c);
        setActivities(
          a.filter(
            (event) =>
              event.task_id === thread.id || JSON.stringify(event.payload).includes(thread.id),
          ),
        );
      }
    });
    return () => {
      live = false;
    };
  }, [thread?.id, store.revision]);
  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ behavior: 'instant' });
  }, [events, queued]);
  const send = async (message: string, options: RunOptions) => {
    setBusy(true);
    try {
      let current = thread;
      if (!current) {
        current = await rpc<AgentThread>('create_agent_thread', {
          ...options,
          project_id: store.project?.id,
          title: message.slice(0, 70),
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
        onSelect(current.id);
      }
      return true;
    } catch (error) {
      toast.error(String(error));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const items = buildTranscriptItems({
    thread: thread || null,
    events,
    activities,
    queued: [],
    cloudRuns,
  });
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {thread && (
          <div className="flex shrink-0 items-center gap-3 px-7 py-3 text-xs text-muted">
            <ProviderLogo
              agent={thread.active_agent || thread.preferred_agent || 'codex'}
              size={16}
            />
            <span className="capitalize">{thread.status.replaceAll('_', ' ')}</span>
            {thread.limit_reset_at && (
              <span>Resets {new Date(thread.limit_reset_at).toLocaleTimeString()}</span>
            )}
            <span className="flex-1" />
            <Button onClick={() => setReview((v) => !v)}>
              <GitBranch size={14} />
              Review changes
            </Button>
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button aria-label="Task actions">
                  <MoreHorizontal size={18} />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  className="z-30 min-w-48 rounded-xl border border-line bg-elevated p-1.5 text-sm shadow-2xl"
                >
                  {[
                    { title: 'Rename task', icon: Pencil, fn: () => setRename(true) },
                    {
                      title: 'Continue in cloud',
                      icon: Cloud,
                      fn: () =>
                        void action(async () => {
                          await rpc('launch_cloud_handoff', { thread_id: thread.id, agent: null });
                          await store.refresh();
                        }, 'Cloud handoff requested'),
                    },
                    {
                      title: 'Reclaim cloud work',
                      icon: Cloud,
                      fn: () =>
                        void action(async () => {
                          await rpc('reclaim_cloud_run', { thread_id: thread.id });
                          await store.refresh();
                        }),
                    },
                    { title: 'Delete task', icon: Trash2, fn: () => setRemove(true) },
                  ].map((item) => (
                    <Dropdown.Item
                      key={item.title}
                      onSelect={item.fn}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none focus:bg-hover"
                    >
                      <item.icon size={14} />
                      {item.title}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        )}
        <div
          ref={scroller}
          onScroll={() => {
            const e = scroller.current!;
            stick.current = e.scrollHeight - e.scrollTop - e.clientHeight < 120;
          }}
          className="min-h-0 flex-1 overflow-y-auto px-7"
        >
          {!thread ? (
            <div className="mx-auto flex h-full max-w-[740px] flex-col justify-center py-6">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[18px] border border-line/70 bg-sidebar/40">
                <PerpetualMark size={32} />
              </div>
              <h1 className="text-[32px] font-medium leading-tight tracking-[-.045em]">
                What are we working on?
              </h1>
              <p className="mt-5 max-w-[510px] text-[14px] leading-7 text-muted">
                Start a task with Codex or Claude. Your context stays with you, even when your
                account changes.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-3">
                {[
                  { icon: Code2, title: 'Build something', text: 'From an idea to working code' },
                  {
                    icon: FileSearch,
                    title: 'Understand a project',
                    text: 'Find your way through a codebase',
                  },
                  {
                    icon: GitPullRequest,
                    title: 'Review changes',
                    text: 'A second look before you ship',
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <button
                    key={title}
                    onClick={() => {
                      fill(
                        title === 'Build something'
                          ? 'Help me build '
                          : title === 'Understand a project'
                            ? 'Explain the architecture of this project and how its main pieces fit together.'
                            : '/review ',
                      );
                    }}
                    className="group rounded-xl border border-line/70 p-4 text-left transition-colors hover:border-muted/50 hover:bg-elevated"
                  >
                    <Icon size={19} strokeWidth={1.5} className="mb-3 text-muted" />
                    <div className="text-[13px] font-medium">{title}</div>
                    <div className="mt-1.5 text-[11px] leading-5 text-muted">{text}</div>
                  </button>
                ))}
              </div>
              {!store.accounts.length && (
                <button
                  onClick={onAccounts}
                  className="mt-7 flex w-fit items-center gap-2 text-xs text-muted hover:text-ink"
                >
                  <span className="flex -space-x-1">
                    <ProviderLogo agent="codex" size={15} />
                    <ProviderLogo agent="claude_code" size={15} />
                  </span>
                  Connect your accounts to get started
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-[760px] pb-8 pt-5">
              {items.map((item) =>
                item.type === 'event' ? (
                  <EventMessage
                    key={item.event.id}
                    event={item.event}
                    agent={thread.active_agent || 'codex'}
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
                ) : item.type === 'transition' ? (
                  <div
                    key={item.id}
                    className="my-5 flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-xs text-muted"
                  >
                    <GitBranch size={15} className="mt-0.5 text-accent" />
                    <div>
                      <p className="text-ink">{item.text}</p>
                      {item.detail && <p className="mt-1 leading-5">{item.detail}</p>}
                    </div>
                  </div>
                ) : null,
              )}
              {!items.length && (
                <p className="py-12 text-center text-sm text-muted">
                  {thread.status === 'draft'
                    ? 'Send a message to start this task.'
                    : 'Waiting for the first response…'}
                </p>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
        <div className="mx-auto w-full max-w-[816px] shrink-0 px-7 pb-6 pt-3">
          {store.approvals
            .filter((a) => a.thread_id === thread?.id)
            .map((a) => (
              <div key={a.id} className="mb-3 rounded-xl border border-accent/35 bg-accent/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <ShieldCheck size={16} />
                  Approval needed · {a.tool_name}
                </div>
                <pre className="mb-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted">
                  {a.command?.join(' ') || JSON.stringify(a.input, null, 2)}
                </pre>
                <p className="mb-3 text-xs text-muted">{a.reason}</p>
                <div className="flex gap-2">
                  {(['allow', 'allow_for_session', 'deny', 'abort'] as const).map((decision) => (
                    <Button
                      key={decision}
                      variant={decision === 'allow' ? 'solid' : 'outline'}
                      onClick={() =>
                        void action(async () => {
                          await rpc('resolve_approval', { id: a.id, decision });
                          await store.refresh();
                        })
                      }
                    >
                      {
                        {
                          allow: 'Allow once',
                          allow_for_session: 'Allow this session',
                          deny: 'Deny',
                          abort: 'Stop',
                        }[decision]
                      }
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          <Queue turns={queued} refresh={store.refresh} />
          <Composer
            draft={draft}
            onCommand={(name) => {
              if (name === 'diff') setReview(true);
              else if (name === 'new') onSelect('');
              else onNavigate(name === 'resume' ? 'search' : name);
            }}
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
        </div>
      </div>
      {review && thread && <Review thread={thread} onClose={() => setReview(false)} />}
      <Modal open={rename} onOpenChange={setRename} title="Rename task">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await rpc('update_agent_thread', { id: thread?.id, patch: { title } });
              await store.refresh();
              setRename(false);
            });
          }}
        >
          <input
            aria-label="Task title"
            className="w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Button type="submit" variant="solid" className="mt-4">
            Save name
          </Button>
        </form>
      </Modal>
      <Modal
        open={remove}
        onOpenChange={setRemove}
        title="Delete this task?"
        description="This removes the task and its conversation history. Running work must be stopped first."
      >
        <Button
          variant="solid"
          onClick={() =>
            void action(async () => {
              await rpc('delete_agent_thread', { id: thread?.id, force: false });
              await store.refresh();
              onSelect('');
              setRemove(false);
            })
          }
        >
          Delete task
        </Button>
      </Modal>
    </div>
  );
}
function XSmall() {
  return <Trash2 size={12} />;
}
function EventMessage({
  event,
  agent,
  onEdit,
  onAnswer,
}: {
  event: AgentThreadEvent;
  agent: string;
  onEdit: (text: string) => void;
  onAnswer: (text: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  if (questionsFromEvent(event).length) return <Questions event={event} onAnswer={onAnswer} />;
  if (!event.text && event.role !== 'tool') return null;
  if (event.role === 'tool' || event.kind.includes('tool'))
    return (
      <details className="my-3 rounded-lg border border-line/60 px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer">
          <Terminal size={13} className="mr-2 inline" />
          {event.kind.replaceAll('_', ' ')}
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap leading-5">
          {event.text || JSON.stringify(event.data, null, 2)}
        </pre>
      </details>
    );
  return (
    <article className={cn('group mb-7', event.role === 'user' ? 'ml-auto max-w-[88%]' : '')}>
      {event.role === 'user' ? (
        <div className="whitespace-pre-wrap rounded-2xl bg-hover px-5 py-3 text-sm leading-7">
          {event.text}
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">
            <ProviderLogo agent={agent} size={19} />
            {event.role === 'assistant' ? (agent === 'codex' ? 'Codex' : 'Claude') : 'Perpetual'}
          </div>
          <div className="prose-chat">
            <Markdown remarkPlugins={[remarkGfm]}>{event.text || ''}</Markdown>
          </div>
        </>
      )}
      <div className="mt-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          aria-label="Copy message"
          onClick={() =>
            void action(async () => {
              await navigator.clipboard.writeText(event.text || '');
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="h-7 px-2"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </Button>
        {event.role === 'user' && (
          <Button
            aria-label="Edit as new message"
            className="h-7 px-2"
            onClick={() => onEdit(event.text || '')}
          >
            <Pencil size={13} />
          </Button>
        )}
      </div>
    </article>
  );
}
