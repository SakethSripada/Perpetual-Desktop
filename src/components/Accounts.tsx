import { useState } from 'react';
import {
  Plus,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  UsersRound,
  Trash2,
  Terminal,
  LockKeyhole,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { action, rpc, signIn, native } from '../lib/api';
import type { AgentKind, LimitPolicy, ProviderAccount, ProviderUsageWindow } from '../lib/types';
import { Button, Empty, Modal, PageHeading, ProviderLogo, Select, Toggle, cn } from './ui';
export function Accounts() {
  const store = useStore();
  const [add, setAdd] = useState(false);
  const [agent, setAgent] = useState<AgentKind>('codex');
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [credits, setCredits] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const policy = store.policy;
  const save = (patch: Partial<LimitPolicy>) =>
    action(async () => {
      if (!policy) throw new Error('Connect to the desktop engine first.');
      setSaving(true);
      try {
        await rpc('set_limit_policy', { ...policy, ...patch });
        await store.refresh();
      } finally {
        setSaving(false);
      }
    });
  const update = (id: string, patch: Partial<ProviderAccount>) =>
    save({ accounts: policy?.accounts?.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const move = (id: string, direction: number) => {
    const accounts = [...(policy?.accounts || [])];
    const index = accounts.findIndex((a) => a.id === id);
    const next = index + direction;
    if (next < 0 || next >= accounts.length) return;
    [accounts[index], accounts[next]] = [accounts[next], accounts[index]];
    void save({ accounts });
  };
  return (
    <>
      <PageHeading
        title="Your accounts"
        description="The right agent. The next available account. One continuous task."
        actions={
          <Button variant="solid" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Add account
          </Button>
        }
      />
      <div className="mb-9 grid grid-cols-2 gap-4">
        {(['codex', 'claude_code'] as const).map((kind) => {
          const status = store.agents.find((a) => a.kind === kind);
          const accounts = store.accounts.filter((a) => a.agent === kind);
          return (
            <section key={kind} className="rounded-2xl border border-line/80 bg-elevated/25 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar">
                  <ProviderLogo agent={kind} size={25} />
                </div>
                <div>
                  <h2 className="text-sm font-medium">
                    {kind === 'codex' ? 'OpenAI Codex' : 'Claude Code'}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {accounts.length
                      ? `${accounts.filter((a) => a.authenticated).length} of ${accounts.length} accounts connected`
                      : status?.authenticated
                        ? 'Local CLI connected'
                        : 'No accounts connected'}
                  </p>
                </div>
                <span className="ml-auto text-xs text-muted">{status?.version || ''}</span>
              </div>
              <div className="mt-6 space-y-4">
                <Usage label="5-hour usage" window={status?.usage?.five_hour} />
                <Usage label="Weekly usage" window={status?.usage?.weekly} />
              </div>
            </section>
          );
        })}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Account priority</h2>
          <p className="mt-1 text-xs text-muted">Perpetual uses enabled accounts in this order.</p>
        </div>
        <Button onClick={() => void action(store.detect, 'Accounts refreshed')}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
      <div className="rounded-xl border border-line/80">
        {store.accounts.length ? (
          store.accounts.map((account, index) => (
            <div
              key={account.id}
              className="flex items-center gap-3 border-b border-line/70 px-5 py-4 last:border-0"
            >
              <ProviderLogo agent={account.agent} size={25} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.label}</p>
                <p className="mt-1 truncate text-xs text-muted">
                  {account.email ||
                    (account.agent === 'codex' ? 'OpenAI subscription' : 'Claude subscription')}
                  {account.reset_at
                    ? ` · Resets ${new Date(account.reset_at).toLocaleString()}`
                    : ''}
                </p>
                {account.detail && <p className="mt-1 text-xs text-muted">{account.detail}</p>}
              </div>
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-[11px]',
                  account.authenticated && account.availability !== 'limited'
                    ? 'bg-accent/10 text-accent'
                    : 'bg-hover text-muted',
                )}
              >
                {!account.enabled
                  ? 'Disabled'
                  : !account.authenticated
                    ? 'Sign in'
                    : account.availability === 'limited'
                      ? 'At limit'
                      : 'Ready'}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  aria-label={`Move ${account.label} up`}
                  disabled={index === 0 || saving}
                  onClick={() => move(account.id, -1)}
                  className="px-1.5"
                >
                  <ArrowUp size={13} />
                </Button>
                <Button
                  aria-label={`Move ${account.label} down`}
                  disabled={index === store.accounts.length - 1 || saving}
                  onClick={() => move(account.id, 1)}
                  className="px-1.5"
                >
                  <ArrowDown size={13} />
                </Button>
              </div>
              <Button variant="outline" onClick={() => void action(() => signIn(account.id))}>
                {account.authenticated ? 'Reconnect' : 'Sign in'}
              </Button>
              <details className="relative">
                <summary
                  aria-label={`Options for ${account.label}`}
                  className="cursor-pointer list-none rounded px-2 py-1 text-muted"
                >
                  •••
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-elevated p-2 shadow-xl">
                  <Button
                    className="w-full justify-start"
                    onClick={() => void update(account.id, { enabled: !account.enabled })}
                  >
                    {account.enabled ? 'Disable account' : 'Enable account'}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    onClick={() => void action(() => signIn(account.id, true))}
                  >
                    <Terminal size={14} />
                    Open account CLI
                  </Button>
                  {account.agent === 'claude_code' && (
                    <Button className="w-full justify-start" onClick={() => setTokenId(account.id)}>
                      <LockKeyhole size={14} />
                      Set setup token
                    </Button>
                  )}
                  {account.agent === 'codex' && (
                    <Button
                      className="w-full justify-start"
                      onClick={() =>
                        account.use_credits
                          ? void update(account.id, { use_credits: false })
                          : setCredits(account.id)
                      }
                    >
                      {account.use_credits ? 'Disable reset credits' : 'Enable reset credits'}
                    </Button>
                  )}
                  <Button
                    className="w-full justify-start text-red-300"
                    onClick={() => setRemove(account.id)}
                  >
                    <Trash2 size={14} />
                    Remove account
                  </Button>
                </div>
              </details>
            </div>
          ))
        ) : (
          <Empty icon={<UsersRound size={26} />} title="Bring your accounts together">
            <p>
              Add your Codex and Claude subscriptions. Each account gets its own isolated sign-in.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => setAdd(true)}>
              <Plus size={14} />
              Connect your first account
            </Button>
          </Empty>
        )}
      </div>
      <div className="mb-2 mt-10 flex items-center gap-2">
        <ArrowRightLeft size={17} className="text-muted" />
        <h2 className="text-sm font-medium">Keep the conversation going</h2>
      </div>
      <div className="divide-y divide-line/60">
        <Toggle
          checked={policy?.auto_switch ?? true}
          disabled={!policy || saving}
          onChange={(v) => void save({ auto_switch: v })}
          label="Switch automatically at a usage limit"
          description="Continue with the next available account, preserving the task, workspace, and queued messages."
        />
        <Toggle
          checked={policy?.switch_back ?? true}
          disabled={!policy || saving}
          onChange={(v) => void save({ switch_back: v })}
          label="Return to the preferred agent"
          description="Switch back when its usage window resets."
        />
        <Toggle
          checked={policy?.resume_with_earliest ?? true}
          disabled={!policy || saving}
          onChange={(v) => void save({ resume_with_earliest: v })}
          label="Resume at the earliest reset"
          description="When every account is limited, wait for the first one to become available."
        />
      </div>
      <div className="mt-3 flex items-center justify-between py-3">
        <div className="text-sm">
          Unknown reset retry
          <p className="mt-1 text-xs text-muted">
            How long to wait when a provider does not report a reset time.
          </p>
        </div>
        <Select
          disabled={!policy || saving}
          value={policy?.unknown_reset_retry_secs ?? 600}
          onChange={(e) => void save({ unknown_reset_retry_secs: +e.target.value })}
        >
          <option value={0}>Never retry</option>
          <option value={60}>1 minute</option>
          <option value={300}>5 minutes</option>
          <option value={600}>10 minutes</option>
          <option value={1800}>30 minutes</option>
        </Select>
      </div>
      <div className="mt-3 flex items-center justify-between py-3">
        <div className="text-sm">
          Preferred provider
          <p className="mt-1 text-xs text-muted">Used when no account pool is configured.</p>
        </div>
        <Select
          disabled={!policy || saving}
          value={policy?.agent_priority[0] || 'claude_code'}
          onChange={(e) =>
            void save({
              agent_priority:
                e.target.value === 'codex' ? ['codex', 'claude_code'] : ['claude_code', 'codex'],
            })
          }
        >
          <option value="codex">Codex first</option>
          <option value="claude_code">Claude first</option>
        </Select>
      </div>
      <h2 className="mb-4 mt-8 text-sm font-medium">Models used when switching</h2>
      <div className="grid grid-cols-2 gap-4">
        {(['codex', 'claude_code'] as const).map((kind) => {
          const profile = policy?.agent_profiles?.find((p) => p.agent === kind);
          const catalog = store.models.find((m) => m.agent === kind);
          const set = (patch: { model?: string | null; reasoning?: string | null }) =>
            save({
              agent_profiles: [
                ...(policy?.agent_profiles || []).filter((p) => p.agent !== kind),
                {
                  agent: kind,
                  model: profile?.model || null,
                  reasoning: profile?.reasoning || null,
                  ...patch,
                },
              ],
            });
          return (
            <div key={kind} className="grid gap-3 rounded-xl border border-line p-4">
              <div className="flex items-center gap-2 text-sm">
                <ProviderLogo agent={kind} size={17} />
                {kind === 'codex' ? 'Codex' : 'Claude'}
              </div>
              <Select
                aria-label={`${kind} fallback model`}
                disabled={!policy}
                value={profile?.model || ''}
                onChange={(e) => void set({ model: e.target.value || null, reasoning: null })}
              >
                <option value="">Provider default</option>
                {catalog?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`${kind} fallback reasoning`}
                disabled={!policy}
                value={profile?.reasoning || ''}
                onChange={(e) => void set({ reasoning: e.target.value || null })}
              >
                <option value="">Default reasoning</option>
                {(
                  catalog?.models.find((m) => m.id === profile?.model)?.reasoning ||
                  catalog?.reasoning ||
                  []
                ).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>
      <Modal
        open={add}
        onOpenChange={setAdd}
        title="Add an account"
        description="Use an account you own. Provider sign-in opens in a dedicated terminal with an isolated profile."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              if (!policy) throw new Error('Open the desktop app to add accounts.');
              const id = crypto.randomUUID();
              await rpc('set_limit_policy', {
                ...policy,
                accounts: [
                  ...(policy.accounts || []),
                  {
                    id,
                    label: label.trim(),
                    agent,
                    enabled: true,
                    use_credits: false,
                    auth_mode: 'isolated_cli',
                  },
                ],
              });
              await store.refresh();
              setAdd(false);
              setLabel('');
              await signIn(id);
            });
          }}
          className="grid gap-4"
        >
          <label className="grid gap-2 text-sm">
            Provider
            <Select value={agent} onChange={(e) => setAgent(e.target.value as AgentKind)}>
              <option value="codex">OpenAI Codex</option>
              <option value="claude_code">Claude Code</option>
            </Select>
          </label>
          <label className="grid gap-2 text-sm">
            Account name
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Personal, work, or a name you recognize"
            />
          </label>
          <Button type="submit" variant="solid" disabled={!label.trim()}>
            Add and sign in
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!tokenId}
        onOpenChange={(v) => {
          if (!v) {
            setTokenId(null);
            setToken('');
          }
        }}
        title="Claude setup token"
        description="Stored in the operating system credential vault. Never saved to the database or transcript."
      >
        <input
          type="password"
          aria-label="Setup token"
          className="w-full"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <Button
          variant="solid"
          className="mt-4"
          disabled={!token.trim()}
          onClick={() =>
            void action(async () => {
              await rpc('set_provider_account_token', { account_id: tokenId, token });
              setToken('');
              setTokenId(null);
              await store.refresh();
            })
          }
        >
          Save token
        </Button>
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Remove this account?"
        description="The account will leave the rotation pool and its saved credentials will be removed."
      >
        <Button
          variant="solid"
          onClick={() =>
            void action(async () => {
              await rpc('delete_provider_account', { account_id: remove });
              await store.refresh();
              setRemove(null);
            })
          }
        >
          Remove account
        </Button>
      </Modal>
      <Modal
        open={!!credits}
        onOpenChange={(v) => !v && setCredits(null)}
        title="Allow earned usage-reset credits?"
        description="Perpetual may redeem an existing earned Codex reset credit for this account when it reaches its limit. This does not buy credits. Other accounts remain unchanged."
      >
        <Button
          variant="solid"
          onClick={() =>
            void action(async () => {
              await update(credits!, { use_credits: true });
              setCredits(null);
            })
          }
        >
          Allow for this account
        </Button>
      </Modal>
    </>
  );
}
function Usage({ label, window }: { label: string; window?: ProviderUsageWindow | null }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span>{window ? `${Math.round(window.used_percent)}% used` : 'Not reported'}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-line/75">
        <div
          className={cn(
            'h-full rounded-full',
            window && window.used_percent >= 90 ? 'bg-amber-400' : 'bg-accent',
          )}
          style={{ width: `${window ? Math.min(100, Math.max(0, window.used_percent)) : 0}%` }}
        />
      </div>
      {window?.reset_at && (
        <p className="mt-1.5 text-[10px] text-muted">
          Resets {new Date(window.reset_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
