/*
 * A scripted stand-in for Perpetual's native engine, used only to record the
 * product videos on the website. It is injected into the real app UI before it
 * loads and answers the same IPC calls the desktop engine answers, playing
 * back fixed scenarios (a usage limit, an account switch, …) that can't be
 * produced on demand with real accounts.
 */
(() => {
  const now = () => new Date().toISOString();
  const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
  const later = (min) => new Date(Date.now() + min * 60_000).toISOString();
  let seq = 0;
  const id = (p) => `${p}-${++seq}`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- State -------------------------------------------------------------
  const project = { id: 'p1', name: 'Workbench', description: null, created_at: ago(9000), updated_at: ago(10) };
  const repos = [
    {
      id: 'r1',
      project_id: 'p1',
      name: 'northwind-api',
      kind: 'local',
      local_path: '/Users/maya/code/northwind-api',
      remote_url: null,
      default_branch: 'main',
      created_at: ago(9000),
      updated_at: ago(9000),
    },
  ];
  const account = (id, agent, label, email, plan, mode) => ({
    id,
    label,
    agent,
    enabled: true,
    use_credits: false,
    auth_mode: mode,
    email,
    plan,
    installed: true,
    active: false,
    authenticated: true,
    availability: 'available',
    reset_at: null,
    detail: null,
  });
  const accounts = [
    account('a1', 'codex', 'Default', 'maya@northwind.dev', 'pro', 'system'),
    account('a2', 'codex', 'Work', 'work@northwind.dev', 'pro', 'isolated_cli'),
    account('a3', 'claude_code', 'Default', 'maya@northwind.dev', 'max', 'system'),
  ];
  const markActive = () => {
    const seen = new Set();
    for (const a of accounts) {
      const ready = a.enabled && a.authenticated && a.availability !== 'limited';
      a.active = ready && !seen.has(a.agent);
      if (a.active) seen.add(a.agent);
    }
  };
  markActive();
  const policy = {
    auto_switch: true,
    switch_back: true,
    agent_priority: ['codex', 'claude_code'],
    agent_profiles: [],
    accounts: accounts.map(({ id, label, agent, enabled, use_credits, auth_mode }) => ({
      id,
      label,
      agent,
      enabled,
      use_credits,
      auth_mode,
    })),
    dismissed_system_accounts: [],
    resume_with_earliest: true,
    unknown_reset_retry_secs: 600,
    keep_awake: true,
  };
  const usage = (five, week) => ({
    five_hour: { used_percent: five, reset_at: later(140) },
    weekly: { used_percent: week, reset_at: later(60 * 24 * 3) },
  });
  const agents = [
    { kind: 'codex', installed: true, authenticated: true, version: '0.161.0', binary_path: 'codex', availability: 'available', reset_at: null, last_checked: now(), usage: usage(64, 31) },
    { kind: 'claude_code', installed: true, authenticated: true, version: '2.1.290', binary_path: 'claude', availability: 'available', reset_at: null, last_checked: now(), usage: usage(22, 18) },
  ];
  const model = (id, label, reasoning) => ({ id, label, aliases: [], family: null, default: false, available: true, source: 'cli', reasoning, default_reasoning: null });
  const codexEffort = ['low', 'medium', 'high', 'xhigh'];
  const claudeEffort = ['low', 'medium', 'high', 'xhigh', 'max'];
  const models = [
    { agent: 'codex', default_model: null, default_reasoning: null, reasoning: codexEffort, binary_path: 'codex', version: '0.161.0', source: 'codex_app_server', detected_at: now(), error: null,
      models: [model('gpt-6-astra', 'GPT-6-Astra', codexEffort), model('gpt-6-sol', 'GPT-6-Sol', codexEffort), model('gpt-5.6-sol', 'GPT-5.6-Sol', codexEffort)] },
    { agent: 'claude_code', default_model: null, default_reasoning: null, reasoning: claudeEffort, binary_path: 'claude', version: '2.1.290', source: 'claude_cli', detected_at: now(), error: null,
      models: [model('claude-fable-5-1', 'Claude Fable 5.1', claudeEffort), model('claude-opus-5-5', 'Claude Opus 5.5', claudeEffort), model('claude-sonnet-5', 'Claude Sonnet 5', claudeEffort), model('claude-haiku-4-5', 'Claude Haiku 4.5', [])] },
  ];
  const thread = (title, status, agent, minutes, extra = {}) => ({
    id: id('t'),
    project_id: 'p1',
    group_id: null,
    title,
    status,
    active_agent: agent,
    preferred_agent: agent,
    permission: 'workspace_write',
    execution_backend: 'host',
    force_managed_workspace: true,
    model: null,
    reasoning: null,
    local_provider: null,
    local_base_url: null,
    model_target: 'frontier_default',
    original_agent: null,
    fallback_agent: null,
    limit_reset_at: null,
    switch_back: true,
    handoff_state: 'none',
    provider_account_id: agent === 'codex' ? 'a1' : 'a3',
    objective: title,
    decisions: '',
    progress: '',
    open_questions: '',
    next_actions: '',
    task_budget: { mode: 'unlimited' },
    sort_order: 0,
    created_at: ago(minutes),
    updated_at: ago(minutes),
    ...extra,
  });
  const threads = [
    thread('Migrate sessions to OAuth 2.1', 'review', 'claude_code', 40),
    thread('Fix the flaky checkout test', 'review', 'codex', 95),
    thread('Profile the search endpoint', 'review', 'codex', 180),
    thread('Write the onboarding guide', 'review', 'claude_code', 320),
    thread('Upgrade to React 19', 'review', 'codex', 900),
    thread('Refactor billing webhooks', 'review', 'claude_code', 1600),
  ];
  const events = new Map(); // thread id -> events
  const turns = new Map(); // thread id -> turns
  const activity = [];
  const approvals = [];

  // ---- Event bus ---------------------------------------------------------
  const callbacks = new Map();
  const listeners = new Map(); // event name -> [handler ids]
  let cbSeq = 1;
  const emit = (name, payload) => {
    for (const handler of listeners.get(name) ?? []) {
      const fn = callbacks.get(handler);
      if (fn) fn({ event: name, id: handler, payload });
    }
  };
  const appEvent = (type, data) => emit('perpetual-event', { event: { type, data } });
  const refresh = () => emit('perpetual-refresh', null);
  const touch = (t) => {
    t.updated_at = now();
    appEvent('agent_thread_updated', structuredClone(t));
  };

  // ---- Scenario building blocks -----------------------------------------
  const list = (tid) => {
    if (!events.has(tid)) events.set(tid, []);
    return events.get(tid);
  };
  const push = (t, turn, role, kind, text, data = {}) => {
    const ev = { id: id('e'), thread_id: t.id, turn_id: turn, role, kind, text, data, ts: now() };
    list(t.id).push(ev);
    appEvent('agent_thread_event', { ...ev });
    return ev;
  };
  const startTurn = (t, agent, accountId) => {
    const turn = { id: id('turn'), thread_id: t.id, agent_kind: agent, agent_session_id: null, state: 'running', permission: 'workspace_write', execution_backend: 'host', sandbox_name: null, started_at: now(), ended_at: null };
    if (!turns.has(t.id)) turns.set(t.id, []);
    turns.get(t.id).push(turn);
    t.active_agent = agent;
    t.provider_account_id = accountId;
    t.status = 'running';
    touch(t);
    return turn.id;
  };
  const stream = async (t, turn, text, cps = 90) => {
    const ev = push(t, turn, 'assistant', 'assistant_text', '', { streaming: true });
    const words = text.split(/(\s+)/);
    let shown = '';
    for (const w of words) {
      shown += w;
      ev.text = shown;
      appEvent('agent_thread_event', { ...ev });
      await wait((w.length / cps) * 1000);
    }
    ev.data = { streaming: false };
    appEvent('agent_thread_event', { ...ev });
  };
  const tool = async (t, turn, name, input, result, { ms = 650, ok = true, file } = {}) => {
    const call = id('call');
    push(t, turn, 'tool', 'tool_use', name, { call_id: call, input });
    await wait(ms);
    push(t, turn, 'tool', 'tool_result', result.split('\n')[0], { call_id: call, ok, summary: result });
    if (file) push(t, turn, 'app', 'file_changed', file, {});
    await wait(180);
  };
  const act = (t, kind, payload) => {
    activity.unshift({ id: id('act'), project_id: 'p1', task_id: t.id, kind, payload: { thread_id: t.id, ...payload }, ts: now() });
    appEvent('activity', {});
  };
  const finish = (t) => {
    for (const turn of turns.get(t.id) ?? []) turn.state = 'completed';
    t.status = 'review';
    touch(t);
  };

  const scenarios = {
    async codex(t, turn) {
      await wait(700);
      await stream(t, turn, "I'll check how requests are made today, then wrap the fetch layer with retries.");
      await wait(300);
      await tool(t, turn, 'Read', { file_path: 'src/api/client.ts' }, 'export async function request(path: string, init?: RequestInit) {');
      await tool(t, turn, 'Search', { pattern: 'fetch(' }, 'src/api/client.ts:18\nsrc/api/upload.ts:42');
      await tool(t, turn, 'Edit', { file_path: 'src/api/retry.ts' }, 'Created src/api/retry.ts', { ms: 900, file: 'Added src/api/retry.ts' });
      await tool(t, turn, 'Edit', { file_path: 'src/api/client.ts' }, 'Updated src/api/client.ts', { ms: 800, file: 'Modified src/api/client.ts' });
      // The account runs out mid-task; Perpetual moves the task to the next account.
      await wait(500);
      const limited = accounts.find((a) => a.id === 'a1');
      limited.availability = 'limited';
      limited.reset_at = later(134);
      markActive();
      act(t, 'thread.account_switched', { from_agent: 'codex', to_agent: 'codex', account_id: 'a2' });
      const next = startTurn(t, 'codex', 'a2');
      refresh();
      await wait(1600);
      await tool(t, next, 'Command', { command: 'npm test -- api' }, '✓ 42 tests passed (6 new)', { ms: 1500, file: 'Added src/api/retry.test.ts' });
      await wait(300);
      await stream(
        t,
        next,
        'Retries are in place.\n\n- **`retry.ts`**: exponential backoff with jitter, up to 5 attempts\n- **`client.ts`**: retries on 429 and 5xx, and honors `Retry-After`\n- **Tests**: 6 new cases; all 42 pass',
        120,
      );
      finish(t);
    },
    async claude(t, turn) {
      await wait(700);
      await stream(t, turn, "I'll read the new retry code and look for cases the tests don't cover.");
      await tool(t, turn, 'Read', { file_path: 'src/api/retry.ts' }, 'export async function withRetry<T>(fn: () => Promise<T>) {');
      await tool(t, turn, 'Edit', { file_path: 'src/api/retry.ts' }, 'Updated src/api/retry.ts', { ms: 900, file: 'Modified src/api/retry.ts' });
      await wait(250);
      await stream(
        t,
        turn,
        'One gap: `Retry-After` can be an HTTP date as well as seconds. It now handles both, and a new test covers the date form.',
        120,
      );
      finish(t);
    },
    async approval(t, turn) {
      await wait(600);
      await stream(t, turn, "I'll add a request timeout, which needs one new dependency.");
      const a = {
        id: id('ap'),
        agent: t.active_agent,
        thread_id: t.id,
        kind: 'command',
        tool_name: 'shell',
        command: ['npm', 'install', 'p-timeout'],
        cwd: '/Users/maya/code/northwind-api',
        input: {},
        reason: 'Installing packages changes package.json and the lockfile.',
        created_at: now(),
      };
      approvals.push(a);
      t.status = 'awaiting_approval';
      touch(t);
      appEvent('approval_requested', a);
      window.__demo.pendingApproval = async () => {
        t.status = 'running';
        touch(t);
        await tool(t, turn, 'Command', { command: 'npm install p-timeout' }, 'added 1 package in 1.2s', { ms: 1100 });
        await stream(t, turn, 'Added a 10 second timeout to every request, with a clear error when it fires.', 120);
        finish(t);
      };
    },
  };

  // ---- IPC ---------------------------------------------------------------
  const clone = (v) => structuredClone(v);
  const handlers = {
    ensure_workbench_project: () => project,
    list_agent_threads: () => threads,
    list_repos: () => repos,
    get_limit_policy: () => policy,
    set_limit_policy: (p) => Object.assign(policy, p),
    provider_account_statuses: () => accounts,
    list_pending_approvals: () => approvals,
    detect_agents: () => agents,
    agent_model_catalog: () => models,
    list_thread_events: ({ thread_id }) => list(thread_id),
    list_queued_turns: () => [],
    list_cloud_runs: () => [],
    list_activity: ({ limit }) => activity.slice(0, limit ?? 200),
    list_thread_turns: ({ thread_id }) => turns.get(thread_id) ?? [],
    list_thread_repos: () => [],
    get_cloud_policy: () => ({ enabled: false }),
    get_work_graph: () => ({ project_id: 'p1', nodes: [], edges: [], repo_bindings: [] }),
    thread_diff: () => ({ repos: [] }),
    assign_thread_repos: () => null,
    activate_provider_account: ({ account_id }) => {
      const i = policy.accounts.findIndex((a) => a.id === account_id);
      const [moved] = policy.accounts.splice(i, 1);
      policy.accounts.unshift(moved);
      const j = accounts.findIndex((a) => a.id === account_id);
      const [status] = accounts.splice(j, 1);
      accounts.unshift(status);
      markActive();
      return null;
    },
    create_agent_thread: (input) => {
      const t = thread(input.title, 'draft', input.preferred_agent ?? 'codex', 0, { objective: input.objective });
      threads.unshift(t);
      appEvent('agent_thread_created', clone(t));
      return t;
    },
    update_agent_thread: ({ id: tid, patch }) => {
      const t = threads.find((x) => x.id === tid);
      Object.assign(t, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      return t;
    },
    send_thread_message: ({ thread_id, agent, message }) => {
      const t = threads.find((x) => x.id === thread_id);
      const acct = accounts.find((a) => a.agent === agent && a.active);
      const turn = startTurn(t, agent, acct?.id ?? null);
      push(t, turn, 'user', 'user_message', message, {});
      const name = window.__demo.next ?? (agent === 'codex' ? 'codex' : 'claude');
      window.__demo.next = null;
      void scenarios[name](t, turn);
      return turn;
    },
    resolve_approval: ({ id: aid }) => {
      const i = approvals.findIndex((a) => a.id === aid);
      if (i >= 0) approvals.splice(i, 1);
      appEvent('approval_resolved', { id: aid, resolution: 'decided' });
      void window.__demo.pendingApproval?.();
      return null;
    },
  };

  const invoke = async (cmd, args) => {
    if (cmd === 'request') {
      const req = args.request;
      const [name, payload] = typeof req === 'string' ? [req, undefined] : Object.entries(req)[0];
      const handler = handlers[name];
      if (!handler) throw `The demo backend doesn't implement ${name}`;
      const value = handler(payload ?? {});
      return value === null || value === undefined ? 'unit' : { value: clone(value) };
    }
    if (cmd === 'plugin:event|listen') {
      if (!listeners.has(args.event)) listeners.set(args.event, []);
      listeners.get(args.event).push(args.handler);
      return args.handler;
    }
    if (cmd === 'plugin:event|unlisten') return null;
    if (cmd === 'plugin:window|is_maximized') return false;
    if (cmd === 'plugin:app|version') return '0.1.0';
    if (cmd === 'data_dir') return '/Users/maya/Library/Application Support/dev.perpetual.desktop';
    return null;
  };

  window.isTauri = true;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    invoke,
    transformCallback(fn) {
      const cb = cbSeq++;
      callbacks.set(cb, fn);
      return cb;
    },
    unregisterCallback(cb) {
      callbacks.delete(cb);
    },
    convertFileSrc: (p) => p,
  };
  window.__demo = { next: null, accounts, threads };
})();
