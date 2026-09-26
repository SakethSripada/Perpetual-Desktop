import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { native, rpc, subscribe, signIn as launchSignIn } from './api';
import { accountName, agentName, errorMessage } from './format';
import type {
  AgentThread,
  AgentThreadEvent,
  AgentStatus,
  AgentModelCatalog,
  LimitPolicy,
  ProviderAccountStatus,
  Project,
  Repo,
  ApprovalRequest,
  AgentKind,
  ProviderUsage,
} from './types';

export interface Snapshot {
  project: Project | null;
  threads: AgentThread[];
  repos: Repo[];
  agents: AgentStatus[];
  accounts: ProviderAccountStatus[];
  policy: LimitPolicy | null;
  models: AgentModelCatalog[];
  approvals: ApprovalRequest[];
}
const empty: Snapshot = {
  project: null,
  threads: [],
  repos: [],
  agents: [],
  accounts: [],
  policy: null,
  models: [],
  approvals: [],
};
type EventListener = (event: AgentThreadEvent) => void;
interface Store extends Snapshot {
  /** True until the first snapshot arrives. */
  loading: boolean;
  error: string | null;
  revision: number;
  refresh: () => Promise<void>;
  detect: () => Promise<void>;
  /** Make an account the one its provider uses next. */
  activate: (account: ProviderAccountStatus) => Promise<void>;
  /** Sign in to an account, or to the provider's own CLI when none is given. */
  signIn: (target: { accountId: string } | { agent: AgentKind }) => Promise<void>;
  savePolicy: (patch: Partial<LimitPolicy>) => Promise<void>;
  onThreadEvent: (listener: EventListener) => () => void;
}
const Context = createContext<Store>(null!);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(native);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const listeners = useRef(new Set<EventListener>());
  const policyRef = useRef<LimitPolicy | null>(null);
  policyRef.current = state.policy;

  const refresh = useCallback(() => {
    if (!native) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      try {
        const project = await rpc<Project>('ensure_workbench_project');
        const [threads, repos, policy, accounts, approvals] = await Promise.all([
          rpc<AgentThread[]>('list_agent_threads', { project_id: null }),
          rpc<Repo[]>('list_repos', { project_id: project.id }),
          rpc<LimitPolicy>('get_limit_policy'),
          rpc<ProviderAccountStatus[]>('provider_account_statuses'),
          rpc<ApprovalRequest[]>('list_pending_approvals'),
        ]);
        // Account statuses may register a CLI sign-in, which updates the policy.
        const latest =
          accounts.length !== (policy.accounts?.length ?? 0)
            ? await rpc<LimitPolicy>('get_limit_policy')
            : policy;
        setState((old) => ({
          ...old,
          project,
          threads,
          repos,
          policy: latest,
          accounts,
          approvals,
        }));
        setError(null);
        setRevision((v) => v + 1);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    };
    inFlight.current = run();
    return inFlight.current;
  }, []);

  const detect = useCallback(async () => {
    if (!native) return;
    const [agents, models] = await Promise.all([
      rpc<AgentStatus[]>('detect_agents'),
      rpc<AgentModelCatalog[]>('agent_model_catalog'),
    ]);
    setState((old) => ({ ...old, agents, models }));
    await refresh();
  }, [refresh]);

  const activate = useCallback(
    async (account: ProviderAccountStatus) => {
      try {
        await rpc('activate_provider_account', { account_id: account.id });
        await refresh();
        toast.success(`${agentName(account.agent)} now uses ${accountName(account)}`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [refresh],
  );

  const signIn = useCallback(
    async (target: { accountId: string } | { agent: AgentKind }) => {
      try {
        const accountId =
          'accountId' in target
            ? target.accountId
            : await rpc<string>('add_system_provider_account', { agent: target.agent });
        await launchSignIn(accountId);
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [refresh],
  );

  const savePolicy = useCallback(
    async (patch: Partial<LimitPolicy>) => {
      const current = policyRef.current;
      if (!current) return;
      const next = { ...current, ...patch };
      setState((old) => ({ ...old, policy: next }));
      try {
        await rpc('set_limit_policy', next);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const onThreadEvent = useCallback((listener: EventListener) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);

  useEffect(() => {
    void refresh();
    void detect().catch((err) => setError(errorMessage(err)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = subscribe((event) => {
      if (!event) {
        void refresh();
        return;
      }
      if (event.type === 'agent_thread_event') {
        const data = event.data as AgentThreadEvent;
        listeners.current.forEach((listener) => listener(data));
        return;
      }
      if (event.type === 'agent_thread_updated' || event.type === 'agent_thread_created') {
        const thread = event.data as AgentThread;
        setState((old) => ({
          ...old,
          threads: old.threads.some((t) => t.id === thread.id)
            ? old.threads.map((t) => (t.id === thread.id ? thread : t))
            : [thread, ...old.threads],
        }));
      }
      if (event.type === 'provider_usage_updated') {
        const usage = event.data as { agent: AgentKind; usage: ProviderUsage };
        setState((old) => ({
          ...old,
          agents: old.agents.map((agent) =>
            agent.kind === usage.agent ? { ...agent, usage: usage.usage } : agent,
          ),
        }));
      }
      if (
        event.type === 'approval_requested' ||
        event.type === 'approval_resolved' ||
        event.type === 'repo_connected'
      )
        void refresh();
      // Throttle instead of debounce: a continuous token stream must still render.
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          setRevision((v) => v + 1);
        }, 250);
    });
    // Coming back to the window (for example after signing in from the provider
    // terminal) re-checks accounts right away.
    let lastFocus = 0;
    const onFocus = () => {
      if (Date.now() - lastFocus < 3000) return;
      lastFocus = Date.now();
      void detect().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      void sub.then((off) => off());
    };
  }, [refresh, detect]);

  return (
    <Context.Provider
      value={{
        ...state,
        loading,
        error,
        revision,
        refresh,
        detect,
        activate,
        signIn,
        savePolicy,
        onThreadEvent,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);

/** The account a provider's next run uses, if any. */
export const activeAccount = (accounts: ProviderAccountStatus[], agent: AgentKind) =>
  accounts.find((a) => a.agent === agent && a.active) ?? null;
