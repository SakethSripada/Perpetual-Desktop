import { useEffect, useMemo, useState } from 'react';
import {
  History,
  ArrowRightLeft,
  Play,
  Plus,
  Trash2,
  CircleAlert,
  Cloud,
  FolderGit2,
  GitMerge,
  Clock,
  ShieldCheck,
  WifiOff,
  Wifi,
  RefreshCw,
  Dot as DotIcon,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { native, rpc } from '../lib/api';
import { accountName, agentName, errorMessage, resetTime } from '../lib/format';
import type { ActivityEvent, AgentKind } from '../lib/types';
import { Card, Empty, PageHeading, Toggle, cn } from './ui';

type Described = { icon: typeof History; text: string; tone?: 'warning' | 'danger' };

const agentOf = (v: unknown) => (v === 'codex' || v === 'claude_code' ? (v as AgentKind) : null);

/** Turns an engine event into a sentence, or null for routine bookkeeping. */
function describe(
  event: ActivityEvent,
  accountLabel: (id: string) => string | null,
): Described | null {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const agent = agentName(agentOf(p.agent));
  const until =
    typeof p.reset_at === 'string' && p.reset_at ? ` until ${resetTime(p.reset_at)}` : '';
  switch (event.kind) {
    case 'thread.created':
      return { icon: Plus, text: 'Task created' };
    case 'thread.turn_started':
      return { icon: Play, text: `${agent} started working` };
    case 'thread.deleted':
    case 'thread.force_deleted':
      return { icon: Trash2, text: 'Task deleted' };
    case 'thread.account_switched': {
      const name = typeof p.account_id === 'string' ? accountLabel(p.account_id) : null;
      return {
        icon: ArrowRightLeft,
        text: `Switched to ${name ?? `another ${agentName(agentOf(p.to_agent))} account`} after a usage limit`,
        tone: 'warning',
      };
    }
    case 'thread.agent_limited':
    case 'agent.limited':
      return { icon: Clock, text: `${agent} reached its usage limit${until}`, tone: 'warning' };
    case 'thread.fallback_started':
      return {
        icon: ArrowRightLeft,
        text: `Switched from ${agentName(agentOf(p.from))} to ${agentName(agentOf(p.to))}`,
        tone: 'warning',
      };
    case 'thread.fallback_waiting':
      return { icon: Clock, text: `Waiting for ${agent} to reset${until}`, tone: 'warning' };
    case 'thread.fallback_disabled':
      return { icon: Clock, text: `Paused at ${agent}'s usage limit${until}`, tone: 'warning' };
    case 'thread.switchback_completed':
      return { icon: RefreshCw, text: `Back on ${agent}` };
    case 'agent.available':
      return { icon: RefreshCw, text: `${agent} is available again` };
    case 'thread.changes_applied':
      return { icon: GitMerge, text: 'Changes applied to the project' };
    case 'thread.cloud_handoff_started':
      return { icon: Cloud, text: `Continued in ${agent} cloud` };
    case 'thread.cloud_handoff_failed':
      return { icon: Cloud, text: 'Cloud handoff failed', tone: 'danger' };
    case 'thread.cloud_reclaimed':
      return { icon: Cloud, text: 'Brought back from the cloud' };
    case 'thread.network_unavailable':
    case 'network.unavailable':
      return { icon: WifiOff, text: 'Lost the network connection', tone: 'warning' };
    case 'network.restored':
      return { icon: Wifi, text: 'Network connection restored' };
    case 'thread.local_fallback_started':
      return { icon: WifiOff, text: 'Switched to a local model while offline', tone: 'warning' };
    case 'thread.local_fallback_failed':
      return { icon: CircleAlert, text: 'Local model fallback failed', tone: 'danger' };
    case 'approval.requested':
      return { icon: ShieldCheck, text: `${agent} asked for approval` };
    case 'repo.connected':
    case 'repo.github_connected':
      return {
        icon: FolderGit2,
        text: `Project added${typeof p.name === 'string' ? `: ${p.name}` : ''}`,
      };
    case 'repo.disconnected':
      return { icon: FolderGit2, text: 'Project removed' };
    case 'scheduler.thread_start_failed':
    case 'scheduler.start_failed':
      return {
        icon: CircleAlert,
        text: `Couldn't resume a task${typeof p.error === 'string' ? `: ${p.error}` : ''}`,
        tone: 'danger',
      };
    case 'scheduler.thread_limit_reset_continue':
    case 'scheduler.account_available_continue':
      return { icon: Play, text: 'Resumed after a usage reset' };
    default:
      return null;
  }
}

function day(ts: string) {
  const date = new Date(ts);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 864e5,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function Activity({ onSelect }: { onSelect: (id: string) => void }) {
  const store = useStore();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!native) return;
    rpc<ActivityEvent[]>('list_activity', { project_id: null, limit: 300 })
      .then((e) => {
        setEvents(e);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [store.revision]);
  const accountLabel = (id: string) => {
    const account = store.accounts.find((a) => a.id === id);
    return account ? accountName(account) : null;
  };
  const rows = useMemo(
    () =>
      (events ?? [])
        .map((event) => {
          const described = describe(event, accountLabel);
          if (described) return { event, ...described };
          if (!all) return null;
          return {
            event,
            icon: DotIcon,
            text: event.kind.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
          } as Described & { event: ActivityEvent };
        })
        .filter((r): r is Described & { event: ActivityEvent } => !!r),
    [events, all, store.accounts],
  );
  const groups = useMemo(() => {
    const out: { day: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const label = day(row.event.ts);
      const last = out[out.length - 1];
      if (last?.day === label) last.rows.push(row);
      else out.push({ day: label, rows: [row] });
    }
    return out;
  }, [rows]);
  const threadId = (event: ActivityEvent) => {
    const p = (event.payload ?? {}) as Record<string, unknown>;
    const id = typeof p.thread_id === 'string' ? p.thread_id : event.task_id;
    return id && store.threads.some((t) => t.id === id) ? id : null;
  };
  return (
    <>
      <PageHeading
        title="Activity"
        description="What happened across your tasks, including account switches and resets."
        actions={
          <label className="flex items-center gap-2 text-xs text-muted">
            Show everything
            <Toggle label="Show everything" checked={all} onChange={setAll} />
          </label>
        }
      />
      {error ? (
        <Card>
          <Empty title="Couldn't load activity">{error}</Empty>
        </Card>
      ) : !groups.length ? (
        <Card>
          <Empty
            icon={<History size={26} strokeWidth={1.5} />}
            title={events || !native ? 'Nothing yet' : 'Loading…'}
          >
            {(events || !native) &&
              'Task starts, account switches, and usage resets will show up here.'}
          </Empty>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.day} className="mb-7">
            <h2 className="mb-2 text-xs font-medium text-faint">{group.day}</h2>
            <Card className="overflow-hidden">
              {group.rows.map(({ event, icon: Icon, text, tone }) => {
                const id = threadId(event);
                const title = id ? store.threads.find((t) => t.id === id)?.title : null;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 text-[13px] last:border-0"
                  >
                    <Icon
                      size={14}
                      className={cn(
                        'shrink-0',
                        tone === 'danger'
                          ? 'text-danger'
                          : tone === 'warning'
                            ? 'text-warning'
                            : 'text-muted',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {text}
                      {title && (
                        <>
                          <span className="text-faint"> · </span>
                          <button
                            onClick={() => onSelect(id!)}
                            className="text-muted underline-offset-2 hover:text-ink hover:underline"
                          >
                            {title}
                          </button>
                        </>
                      )}
                    </span>
                    <time className="shrink-0 text-xs text-faint tabular-nums">
                      {new Date(event.ts).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </>
  );
}
