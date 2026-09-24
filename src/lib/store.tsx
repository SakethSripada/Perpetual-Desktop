import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { native, rpc, subscribe } from './api';
import type {
  AgentThread,
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
interface Store extends Snapshot {
  loading: boolean;
  error: string | null;
  revision: number;
  refresh: () => Promise<void>;
  detect: () => Promise<void>;
}
const Context = createContext<Store>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(native);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef<Promise<void> | null>(null);
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
        setState((old) => ({ ...old, project, threads, repos, policy, accounts, approvals }));
        setError(null);
        setRevision((v) => v + 1);
      } catch (error) {
        setError(String(error));
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
  useEffect(() => {
    void refresh();
    void detect().catch((error) => setError(String(error)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = subscribe((event) => {
      if (!event) {
        void refresh();
        return;
      }
      if (event.type === 'agent_thread_updated' || event.type === 'agent_thread_created') {
        const thread = event.data as AgentThread;
        setState((old) => ({
          ...old,
          threads: [thread, ...old.threads.filter((t) => t.id !== thread.id)],
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
      if (event.type === 'approval_requested' || event.type === 'approval_resolved') void refresh();
      // Throttle instead of debounce: a continuous token stream must still render.
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          setRevision((v) => v + 1);
        }, 200);
    });
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      void sub.then((off) => off());
    };
  }, [refresh, detect]);
  return (
    <Context.Provider value={{ ...state, loading, error, revision, refresh, detect }}>
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
