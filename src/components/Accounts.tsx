import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Plus,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Terminal,
  KeyRound,
  LogIn,
  Pause,
  Play,
  Check,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { credentialStore } from '../lib/platform';
import { action, native, rpc, signIn } from '../lib/api';
import {
  INSTALL_URLS,
  PROVIDERS,
  accountDetail,
  accountName,
  accountState,
  accountStateLabel,
  providerName,
  resetTime,
} from '../lib/format';
import type {
  AgentKind,
  ProviderAccount,
  ProviderAccountAuthMode,
  ProviderAccountStatus,
  ProviderUsageWindow,
} from '../lib/types';
import {
  Badge,
  Button,
  Card,
  Confirm,
  ContextActions,
  Empty,
  MoreActions,
  type Action,
  IconButton,
  Modal,
  PageHeading,
  ProviderLogo,
  Row,
  Section,
  Select,
  ToggleRow,
  cn,
} from './ui';

export function Accounts({
  addOpen,
  setAddOpen,
}: {
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}) {
  const store = useStore();
  const policy = store.policy;
  const [refreshing, setRefreshing] = useState(false);
  const [rename, setRename] = useState<ProviderAccountStatus | null>(null);
  const [remove, setRemove] = useState<ProviderAccountStatus | null>(null);
  const [token, setToken] = useState<ProviderAccountStatus | null>(null);
  const [credits, setCredits] = useState<ProviderAccountStatus | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const ordered = (policy?.accounts ?? []) as ProviderAccount[];
  const statusFor = (id: string) => store.accounts.find((a) => a.id === id);
  const rows = ordered.map((a) => statusFor(a.id)).filter(Boolean) as ProviderAccountStatus[];

  const update = (id: string, patch: Partial<ProviderAccount>) =>
    store.savePolicy({ accounts: ordered.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const reorder = (from: string, to: string) => {
    const next = [...ordered];
    const fromIndex = next.findIndex((a) => a.id === from);
    const toIndex = next.findIndex((a) => a.id === to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    void store.savePolicy({ accounts: next });
  };
  const move = (id: string, step: number) => {
    const index = ordered.findIndex((a) => a.id === id);
    const target = ordered[index + step];
    if (target) reorder(id, target.id);
  };
  const accountActions = (account: ProviderAccountStatus, index: number): Action[] => [
    ...(!account.active && account.enabled && account.authenticated
      ? [{ label: 'Use this account', icon: Check, onSelect: () => void store.activate(account) }]
      : []),
    { label: 'Rename', icon: Pencil, onSelect: () => setRename(account) },
    {
      label: 'Move up',
      icon: ArrowUp,
      disabled: index === 0,
      onSelect: () => move(account.id, -1),
    },
    {
      label: 'Move down',
      icon: ArrowDown,
      disabled: index === rows.length - 1,
      onSelect: () => move(account.id, 1),
    },
    account.auth_mode === 'oauth_token'
      ? {
          label: 'Update setup token',
          icon: KeyRound,
          separated: true,
          onSelect: () => setToken(account),
        }
      : {
          label: account.authenticated ? 'Sign in again' : 'Sign in',
          icon: LogIn,
          separated: true,
          onSelect: () => void store.signIn({ accountId: account.id }),
        },
    {
      label: 'Open in terminal',
      icon: Terminal,
      disabled: !account.installed,
      onSelect: () => void action(() => signIn(account.id, true)),
    },
    ...(account.agent === 'codex'
      ? [
          {
            label: account.use_credits ? 'Stop using reset credits' : 'Use earned reset credits',
            icon: Gift,
            onSelect: () =>
              account.use_credits
                ? void update(account.id, { use_credits: false })
                : setCredits(account),
          },
        ]
      : []),
    {
      label: account.enabled ? 'Pause in rotation' : 'Resume in rotation',
      icon: account.enabled ? Pause : Play,
      onSelect: () => void update(account.id, { enabled: !account.enabled }),
    },
    {
      label: 'Remove',
      icon: Trash2,
      danger: true,
      separated: true,
      onSelect: () => setRemove(account),
    },
  ];
  const refresh = async () => {
    setRefreshing(true);
    await action(store.detect);
    setRefreshing(false);
  };

  return (
    <>
      <PageHeading
        title="Accounts"
        description="Tasks run on each provider's active account and move to the next one when it reaches a usage limit."
        actions={
          <>
            <IconButton label="Check sign-in status" onClick={() => void refresh()}>
              <RefreshCw size={15} className={cn(refreshing && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" onClick={() => setAddOpen(true)} disabled={!native}>
              <Plus size={15} />
              Add account
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((agent) => (
          <ProviderCard key={agent} agent={agent} />
        ))}
      </div>

      <Section
        title="Switching order"
        description="Drag to reorder. The first ready account of each provider is the one in use."
        className="mt-9"
      >
        <Card className="overflow-hidden">
          {rows.length ? (
            rows.map((account, index) => {
              const state = accountState(account);
              return (
                <ContextActions key={account.id} actions={accountActions(account, index)}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDragging(account.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (!dragging) return;
                      e.preventDefault();
                      setOver(account.id);
                    }}
                    onDragLeave={() => setOver((v) => (v === account.id ? null : v))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging) reorder(dragging, account.id);
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      'group flex items-center gap-3 border-b border-line/60 py-3 pr-3 pl-1.5 transition-colors last:border-0',
                      dragging === account.id && 'opacity-40',
                      over === account.id && dragging !== account.id && 'bg-hover',
                    )}
                  >
                    <GripVertical
                      size={15}
                      className="shrink-0 cursor-grab text-faint opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                    />
                    <span className="w-3 shrink-0 text-right text-xs text-faint tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hover">
                      <ProviderLogo agent={account.agent} size={16} />
                    </div>
                    <div className={cn('min-w-0 flex-1', !account.enabled && 'opacity-55')}>
                      <div className="truncate text-[13px] font-medium selectable">
                        {accountName(account)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {accountDetail(account) || providerName(account.agent)}
                      </div>
                    </div>
                    <StateBadge account={account} />
                    {state === 'ready' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void store.activate(account)}
                      >
                        Use
                      </Button>
                    )}
                    {state === 'signed_out' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          account.auth_mode === 'oauth_token'
                            ? setToken(account)
                            : void store.signIn({ accountId: account.id })
                        }
                      >
                        Sign in
                      </Button>
                    )}
                    <MoreActions
                      label={`Options for ${accountName(account)}`}
                      actions={accountActions(account, index)}
                    />
                  </div>
                </ContextActions>
              );
            })
          ) : (
            <Empty
              title={store.loading ? 'Loading accounts…' : 'No accounts yet'}
              action={
                !store.loading && (
                  <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={!native}>
                    <Plus size={14} />
                    Add account
                  </Button>
                )
              }
            >
              {!store.loading && 'Add a Codex or Claude account. You can add several of each.'}
            </Empty>
          )}
        </Card>
      </Section>

      <Section title="Automatic switching">
        <div className="divide-y divide-line/60">
          <ToggleRow
            label="Switch accounts at a usage limit"
            description="Continue the task on the next ready account, with its workspace and queued messages."
            checked={policy?.auto_switch ?? true}
            disabled={!policy}
            onChange={(v) => void store.savePolicy({ auto_switch: v })}
          />
          <ToggleRow
            label="Switch back after a reset"
            description="Return to the original provider when its limit resets."
            checked={policy?.switch_back ?? true}
            disabled={!policy}
            onChange={(v) => void store.savePolicy({ switch_back: v })}
          />
          <ToggleRow
            label="Resume with the first account to reset"
            description="When every account is limited, continue as soon as any of them is ready."
            checked={policy?.resume_with_earliest ?? true}
            disabled={!policy}
            onChange={(v) => void store.savePolicy({ resume_with_earliest: v })}
          />
          <Row
            label="Retry when no reset time is reported"
            description="Some limits don't say when they end."
          >
            <Select
              aria-label="Retry interval"
              disabled={!policy}
              value={policy?.unknown_reset_retry_secs ?? 600}
              onChange={(e) => void store.savePolicy({ unknown_reset_retry_secs: +e.target.value })}
            >
              <option value={300}>After 5 minutes</option>
              <option value={600}>After 10 minutes</option>
              <option value={1800}>After 30 minutes</option>
              <option value={3600}>After 1 hour</option>
              <option value={0}>Never</option>
            </Select>
          </Row>
        </div>
      </Section>

      <Section
        title="Models after a switch"
        description="What a task uses when it moves to a different provider."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {PROVIDERS.map((agent) => (
            <SwitchProfile key={agent} agent={agent} />
          ))}
        </div>
      </Section>

      <AddAccount open={addOpen} onOpenChange={setAddOpen} onToken={setToken} />
      <RenameAccount account={rename} onClose={() => setRename(null)} onSave={update} />
      <TokenDialog account={token} onClose={() => setToken(null)} />
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title={`Remove ${remove ? accountName(remove) : 'account'}?`}
        description={
          remove?.auth_mode === 'system'
            ? `Perpetual will stop using this sign-in. You stay signed in to the ${remove ? providerName(remove.agent) : ''} CLI.`
            : 'Perpetual will delete the sign-in it saved for this account.'
        }
        confirmLabel="Remove"
        danger
        onConfirm={() =>
          action(async () => {
            await rpc('delete_provider_account', { account_id: remove!.id });
            await store.refresh();
          })
        }
      />
      <Confirm
        open={!!credits}
        onOpenChange={(v) => !v && setCredits(null)}
        title="Use earned reset credits?"
        description="When this account reaches its limit, Perpetual may redeem a usage-reset credit you've already earned. It never buys credits."
        confirmLabel="Allow"
        onConfirm={() => update(credits!.id, { use_credits: true })}
      />
    </>
  );
}

function StateBadge({ account }: { account: ProviderAccountStatus }) {
  const state = accountState(account);
  if (state === 'ready') return null;
  const tone =
    state === 'active'
      ? 'success'
      : state === 'limited'
        ? 'warning'
        : state === 'missing'
          ? 'danger'
          : 'neutral';
  return <Badge tone={tone}>{accountStateLabel(account)}</Badge>;
}

function ProviderCard({ agent }: { agent: AgentKind }) {
  const store = useStore();
  const status = store.agents.find((a) => a.kind === agent);
  const accounts = store.accounts.filter((a) => a.agent === agent);
  const installed = status?.installed ?? accounts.some((a) => a.installed);
  const ready = accounts.filter((a) => a.enabled && a.authenticated).length;
  const usage = status?.usage;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hover">
          <ProviderLogo agent={agent} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{providerName(agent)}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {!status && store.loading
              ? 'Checking…'
              : !installed
                ? 'CLI not installed'
                : accounts.length
                  ? `${ready} of ${accounts.length} signed in`
                  : 'Not signed in'}
          </div>
        </div>
        {!installed && status ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void action(() => openUrl(INSTALL_URLS[agent]))}
          >
            Install
            <ExternalLink size={12} />
          </Button>
        ) : installed && !accounts.length ? (
          <Button size="sm" variant="secondary" onClick={() => void store.signIn({ agent })}>
            Sign in
          </Button>
        ) : (
          status?.version && (
            <span className="max-w-28 truncate text-[11px] text-faint" title={status.version}>
              {status.version.replace(/^codex-cli\s*/i, '').replace(/\s*\(.*\)$/, '')}
            </span>
          )
        )}
      </div>
      {installed && (
        <div className="mt-4 space-y-3">
          {usage?.five_hour || usage?.weekly ? (
            <>
              <Usage label="5-hour" window={usage.five_hour} />
              <Usage label="Weekly" window={usage.weekly} />
            </>
          ) : (
            <p className="text-xs text-faint">Usage appears after the next run.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function Usage({ label, window }: { label: string; window?: ProviderUsageWindow | null }) {
  if (!window) return null;
  const used = Math.min(100, Math.max(0, window.used_percent));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(used)}% used
          {window.reset_at && (
            <span className="text-faint"> · resets {resetTime(window.reset_at)}</span>
          )}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div
          className={cn('h-full rounded-full', used >= 90 ? 'bg-warning' : 'bg-accent')}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  );
}

function SwitchProfile({ agent }: { agent: AgentKind }) {
  const store = useStore();
  const policy = store.policy;
  const profile = policy?.agent_profiles?.find((p) => p.agent === agent);
  const catalog = store.models.find((m) => m.agent === agent);
  const efforts =
    catalog?.models.find((m) => m.id === profile?.model)?.reasoning || catalog?.reasoning || [];
  const set = (patch: { model?: string | null; reasoning?: string | null }) =>
    void store.savePolicy({
      agent_profiles: [
        ...(policy?.agent_profiles || []).filter((p) => p.agent !== agent),
        { agent, model: profile?.model || null, reasoning: profile?.reasoning || null, ...patch },
      ],
    });
  return (
    <Card className="grid gap-2.5 p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <ProviderLogo agent={agent} size={14} />
        {providerName(agent)}
      </div>
      <Select
        aria-label={`${providerName(agent)} model after a switch`}
        disabled={!policy}
        value={profile?.model || ''}
        onChange={(e) => set({ model: e.target.value || null, reasoning: null })}
      >
        <option value="">Default model</option>
        {catalog?.models
          .filter((m) => m.available || m.id === profile?.model)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
      </Select>
      <Select
        aria-label={`${providerName(agent)} reasoning after a switch`}
        disabled={!policy || !efforts.length}
        value={profile?.reasoning || ''}
        onChange={(e) => set({ reasoning: e.target.value || null })}
      >
        <option value="">Default reasoning</option>
        {efforts.map((r) => (
          <option key={r} value={r}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </option>
        ))}
      </Select>
    </Card>
  );
}

function AddAccount({
  open,
  onOpenChange,
  onToken,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToken: (account: ProviderAccountStatus) => void;
}) {
  const store = useStore();
  const [agent, setAgent] = useState<AgentKind>('codex');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<ProviderAccountAuthMode>('isolated_cli');
  const [busy, setBusy] = useState(false);
  const installed =
    store.agents.find((a) => a.kind === agent)?.installed ??
    store.accounts.some((a) => a.agent === agent && a.installed);
  const hasSystem = store.accounts.some((a) => a.agent === agent && a.auth_mode === 'system');
  const close = () => {
    onOpenChange(false);
    setLabel('');
    setMode('isolated_cli');
  };
  const add = async () => {
    const policy = store.policy;
    if (!policy) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const authMode = agent === 'claude_code' ? mode : 'isolated_cli';
    const ok = await action(async () => {
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
            auth_mode: authMode,
          },
        ],
      });
      await store.refresh();
      return true;
    });
    setBusy(false);
    if (!ok) return;
    close();
    if (authMode === 'oauth_token') {
      const created = {
        id,
        label: label.trim(),
        agent,
        auth_mode: authMode,
      } as ProviderAccountStatus;
      onToken(created);
      await action(() => signIn(id));
    } else {
      await store.signIn({ accountId: id });
    }
  };
  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title="Add account"
      description="Each account has its own sign-in."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!label.trim() || !installed}
            onClick={() => void add()}
          >
            Continue to sign in
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim() && installed) void add();
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((kind) => (
            <button
              type="button"
              key={kind}
              onClick={() => setAgent(kind)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] transition-colors',
                agent === kind ? 'border-accent bg-accent/5' : 'border-line hover:bg-hover',
              )}
            >
              <ProviderLogo agent={kind} size={16} />
              {providerName(kind)}
            </button>
          ))}
        </div>
        {!installed && (
          <p className="text-xs leading-5 text-warning">
            The {providerName(agent)} CLI isn't installed on this computer.{' '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void action(() => openUrl(INSTALL_URLS[agent]))}
            >
              Get it here
            </button>
            , then come back.
          </p>
        )}
        <label className="grid gap-1.5 text-[13px]">
          Name
          <input
            autoFocus
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Personal, Work…"
          />
        </label>
        {agent === 'claude_code' && (
          <label className="grid gap-1.5 text-[13px]">
            Sign-in method
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as ProviderAccountAuthMode)}
            >
              <option value="isolated_cli">Browser sign-in</option>
              <option value="oauth_token">Setup token</option>
            </Select>
          </label>
        )}
        {installed && !hasSystem && (
          <button
            type="button"
            className="-mt-1 text-left text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              close();
              void store.signIn({ agent });
            }}
          >
            Use the {providerName(agent)} CLI's existing sign-in instead
          </button>
        )}
      </form>
    </Modal>
  );
}

function RenameAccount({
  account,
  onClose,
  onSave,
}: {
  account: ProviderAccountStatus | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<ProviderAccount>) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [prev, setPrev] = useState<string | null>(null);
  if (account && prev !== account.id) {
    setPrev(account.id);
    setLabel(account.label);
  }
  const save = async () => {
    if (!account || !label.trim()) return;
    await onSave(account.id, { label: label.trim() });
    onClose();
  };
  return (
    <Modal
      open={!!account}
      onOpenChange={(v) => {
        if (!v) {
          setPrev(null);
          onClose();
        }
      }}
      title="Rename account"
      width={400}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!label.trim()} onClick={() => void save()}>
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
        <input
          autoFocus
          aria-label="Account name"
          className="w-full"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </form>
    </Modal>
  );
}

function TokenDialog({
  account,
  onClose,
}: {
  account: ProviderAccountStatus | null;
  onClose: () => void;
}) {
  const store = useStore();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    setToken('');
    onClose();
  };
  const save = async () => {
    if (!account || !token.trim()) return;
    setBusy(true);
    const ok = await action(async () => {
      await rpc('set_provider_account_token', { account_id: account.id, token: token.trim() });
      await store.refresh();
      return true;
    }, 'Signed in');
    setBusy(false);
    if (ok) close();
  };
  return (
    <Modal
      open={!!account}
      onOpenChange={(v) => !v && close()}
      title="Add setup token"
      description={
        <>
          Paste the token printed by <code className="font-mono text-ink">claude setup-token</code>.
          It's stored in {credentialStore}, never in Perpetual's database.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!token.trim()}
            onClick={() => void save()}
          >
            Save token
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
        <input
          autoFocus
          type="password"
          aria-label="Setup token"
          placeholder="sk-ant-oat…"
          autoComplete="off"
          spellCheck={false}
          className="w-full font-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </form>
    </Modal>
  );
}
