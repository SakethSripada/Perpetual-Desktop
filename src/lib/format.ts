import type { AgentKind, ProviderAccountStatus, TaskStatus } from './types';

export const agentName = (agent: AgentKind | null | undefined) =>
  agent === 'codex' ? 'Codex' : agent === 'claude_code' ? 'Claude' : 'Agent';

export const providerName = (agent: AgentKind) => (agent === 'codex' ? 'Codex' : 'Claude Code');

export const PROVIDERS: AgentKind[] = ['codex', 'claude_code'];

export const INSTALL_URLS: Record<AgentKind, string> = {
  codex: 'https://developers.openai.com/codex/cli',
  claude_code: 'https://docs.anthropic.com/en/docs/claude-code/setup',
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  prolite: 'Pro Lite',
  max: 'Max',
  team: 'Team',
  business: 'Business',
  enterprise: 'Enterprise',
  edu: 'Edu',
};

export const planName = (plan: string | null | undefined) =>
  plan ? (PLAN_NAMES[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1)) : null;

/** The name people recognize an account by: its email when known. */
export function accountName(account: ProviderAccountStatus) {
  if (account.email) return account.email;
  if (account.auth_mode === 'system') return `${providerName(account.agent)} sign-in`;
  return account.label;
}

/** Secondary line: the user's label (when the email is the title), plan, and origin. */
export function accountDetail(account: ProviderAccountStatus) {
  const parts: string[] = [];
  if (account.auth_mode === 'system') parts.push(`Shared with ${agentName(account.agent)} CLI`);
  else if (account.email && account.label) parts.push(account.label);
  const plan = planName(account.plan);
  if (plan) parts.push(plan);
  return parts.join(' · ');
}

export type AccountState = 'active' | 'ready' | 'limited' | 'signed_out' | 'disabled' | 'missing';

export function accountState(account: ProviderAccountStatus): AccountState {
  if (!account.installed) return 'missing';
  if (!account.enabled) return 'disabled';
  if (!account.authenticated) return 'signed_out';
  if (account.availability === 'limited') return 'limited';
  return account.active ? 'active' : 'ready';
}

export function accountStateLabel(account: ProviderAccountStatus) {
  switch (accountState(account)) {
    case 'active':
      return 'Active';
    case 'ready':
      return 'Ready';
    case 'limited':
      return account.reset_at ? `Limited until ${resetTime(account.reset_at)}` : 'At usage limit';
    case 'signed_out':
      return 'Signed out';
    case 'disabled':
      return 'Paused';
    case 'missing':
      return 'CLI not installed';
  }
}

/** "3:40 PM", "Tomorrow 9:00 AM", or "Mon 9:00 AM". */
export function resetTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const days = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 864e5,
  );
  if (days <= 0) return time;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 45) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export const STATUS: Record<TaskStatus, { label: string; tone: Tone; live?: boolean }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'neutral', live: true },
  running: { label: 'Working', tone: 'accent', live: true },
  running_in_cloud: { label: 'Working in cloud', tone: 'accent', live: true },
  awaiting_approval: { label: 'Needs approval', tone: 'warning', live: true },
  waiting_for_limit: { label: 'Waiting for a reset', tone: 'warning' },
  waiting_for_network: { label: 'Waiting for network', tone: 'warning' },
  paused: { label: 'Paused', tone: 'neutral' },
  review: { label: 'Finished', tone: 'success' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Stopped', tone: 'neutral' },
};

export const statusInfo = (status: TaskStatus) =>
  STATUS[status] ?? { label: status.replaceAll('_', ' '), tone: 'neutral' as Tone };

/** Translate provider envelopes into useful messages at every UI boundary. */
export function errorMessage(error: unknown): string {
  let value: unknown = error instanceof Error ? error.message : error;
  for (let depth = 0; depth < 6; depth++) {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      value = record.error ?? record.message ?? record.detail;
      continue;
    }
    if (typeof value !== 'string') break;
    const text = value.replace(/^(?:(?:Error|Other|CoreError|Server):\s*)+/i, '').trim();
    // Some transports prefix the JSON body with an HTTP status or explanation.
    const body = text.slice(text.indexOf('{'));
    try {
      value = JSON.parse(text);
      continue;
    } catch {
      /* Not a standalone envelope. */
    }
    if (text.includes('{')) {
      try {
        value = JSON.parse(body);
        continue;
      } catch {
        /* Plain text. */
      }
    }
    if (
      /model[\s\S]*(?:not supported|not available|does not exist|do not have access|don't have access)/i.test(
        text,
      )
    ) {
      const model = /['"]([^'"\s]+)['"]\s+model/i.exec(text)?.[1];
      return `${model || 'This model'} isn’t available with the selected account. Choose a supported model from the model menu, then send your message again.`;
    }
    if (
      /unauthorized|unauthenticated|invalid[ _-]*(?:api[ _-]*)?key|authentication[_ ]error|not (?:logged|signed) in/i.test(
        text,
      )
    ) {
      return 'This account needs to sign in again. Open Accounts to reconnect it, then try again.';
    }
    if (/rate[_ -]?limit|too many requests|quota exceeded/i.test(text)) {
      return 'This account has reached its usage limit. Switch accounts or try again after the limit resets.';
    }
    if (/overloaded|service unavailable|internal server error/i.test(text)) {
      return 'The provider is temporarily unavailable. Please try again shortly.';
    }
    if (/timed? out|timeout/i.test(text)) {
      return 'The provider took too long to respond. Please try again.';
    }
    if (text.startsWith('{') || text.startsWith('[')) break;
    return text || 'Something went wrong. Please try again.';
  }
  return 'The provider couldn’t complete this request. Please try again.';
}

/** The command a tool ran, without the shell that wrapped it (`powershell -Command '…'`). */
export function shellCommand(command: string) {
  const match =
    /^\s*"?[^"\s]*?\b(?:powershell|pwsh|cmd|bash|sh|zsh)(?:\.exe)?"?\s+(?:-NoProfile\s+|-NoLogo\s+)*(?:-Command|-c|-lc|\/c)\s+([\s\S]+)$/i.exec(
      command,
    );
  if (!match) return command.trim();
  const inner = match[1].trim();
  const quote = inner[0];
  return (quote === "'" || quote === '"') && inner.endsWith(quote) && inner.length > 1
    ? inner.slice(1, -1)
    : inner;
}
