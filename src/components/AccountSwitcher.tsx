import { ChevronsUpDown, Plus, Settings2, LogIn } from 'lucide-react';
import { activeAccount, useStore } from '../lib/store';
import {
  PROVIDERS,
  accountName,
  accountState,
  accountStateLabel,
  planName,
  providerName,
} from '../lib/format';
import type { AgentKind, ProviderAccountStatus } from '../lib/types';
import {
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  ProviderLogo,
  cn,
} from './ui';

/** Menu body listing accounts by provider; choosing one makes it active. */
export function AccountMenuContent({
  agents = PROVIDERS,
  onManage,
  onAdd,
  side,
  align = 'start',
}: {
  agents?: AgentKind[];
  onManage: () => void;
  onAdd?: () => void;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}) {
  const store = useStore();
  return (
    <MenuContent side={side} align={align} className="w-72">
      {agents.map((agent, index) => {
        const accounts = store.accounts.filter((a) => a.agent === agent);
        const active = activeAccount(store.accounts, agent);
        return (
          <div key={agent}>
            {index > 0 && <MenuSeparator />}
            <MenuLabel className="flex items-center gap-2">
              <ProviderLogo agent={agent} size={12} />
              {providerName(agent)}
            </MenuLabel>
            {accounts.length === 0 && (
              <MenuItem onSelect={() => void store.signIn({ agent })}>
                <LogIn size={14} className="text-muted" />
                Sign in
              </MenuItem>
            )}
            <MenuRadioGroup value={active?.id ?? ''}>
              {accounts.map((account) => (
                <AccountOption key={account.id} account={account} />
              ))}
            </MenuRadioGroup>
          </div>
        );
      })}
      <MenuSeparator />
      {onAdd && (
        <MenuItem onSelect={onAdd}>
          <Plus size={14} className="text-muted" />
          Add account
        </MenuItem>
      )}
      <MenuItem onSelect={onManage}>
        <Settings2 size={14} className="text-muted" />
        Manage accounts
      </MenuItem>
    </MenuContent>
  );
}

function AccountOption({ account }: { account: ProviderAccountStatus }) {
  const store = useStore();
  const state = accountState(account);
  const usable = state === 'active' || state === 'ready' || state === 'limited';
  return (
    <MenuRadioItem
      value={account.id}
      className="h-auto min-h-8 py-1.5"
      onSelect={(event) => {
        if (state === 'signed_out') {
          void store.signIn({ accountId: account.id });
        } else if (usable && !account.active) {
          void store.activate(account);
        } else {
          event.preventDefault();
        }
      }}
      disabled={state === 'missing'}
    >
      <div className="min-w-0">
        <div className="truncate">{accountName(account)}</div>
        {state !== 'active' && state !== 'ready' ? (
          <div className={cn('text-[11px]', state === 'limited' ? 'text-warning' : 'text-faint')}>
            {state === 'signed_out' ? 'Signed out · select to sign in' : accountStateLabel(account)}
          </div>
        ) : (
          planName(account.plan) && (
            <div className="text-[11px] text-faint">{planName(account.plan)}</div>
          )
        )}
      </div>
    </MenuRadioItem>
  );
}

/** Sidebar footer: which account each provider is using, and a switcher. */
export function SidebarAccounts({ onManage, onAdd }: { onManage: () => void; onAdd: () => void }) {
  const store = useStore();
  const providers = PROVIDERS.filter(
    (agent) =>
      store.accounts.some((a) => a.agent === agent) ||
      store.agents.some((s) => s.kind === agent && s.installed),
  );
  if (store.loading) return <div className="h-[62px]" />;
  if (!providers.length)
    return (
      <button
        onClick={onManage}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
      >
        <LogIn size={16} />
        Set up an account
      </button>
    );
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          aria-label="Switch account"
          className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-hover data-[state=open]:bg-hover"
        >
          <div className="min-w-0 flex-1 space-y-1">
            {providers.map((agent) => {
              const active = activeAccount(store.accounts, agent);
              const limited =
                !active &&
                store.accounts.some((a) => a.agent === agent && accountState(a) === 'limited');
              return (
                <div key={agent} className="flex items-center gap-2 text-xs">
                  <ProviderLogo agent={agent} size={13} />
                  <span
                    className={cn(
                      'truncate',
                      active ? 'text-ink/90' : limited ? 'text-warning' : 'text-faint',
                    )}
                  >
                    {active
                      ? accountName(active)
                      : limited
                        ? 'All accounts at limit'
                        : 'Not signed in'}
                  </span>
                </div>
              );
            })}
          </div>
          <ChevronsUpDown size={14} className="shrink-0 text-faint group-hover:text-muted" />
        </button>
      </MenuTrigger>
      <AccountMenuContent side="top" onManage={onManage} onAdd={onAdd} />
    </MenuRoot>
  );
}
