// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from './store';
import { rpc } from './api';
import type { LimitPolicy } from './types';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Composer } from '../components/Composer';
import { Accounts } from '../components/Accounts';

vi.mock('./api', () => ({
  native: true,
  rpc: vi.fn(),
  subscribe: () => Promise.resolve(() => {}),
  signIn: vi.fn(),
  action: async (run: () => Promise<unknown>) => run(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let store: ReturnType<typeof useStore>;
let root: Root;
let container: HTMLDivElement;
let saved: LimitPolicy;
function Capture() {
  store = useStore();
  return null;
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  saved = {
    auto_switch: true,
    switch_back: true,
    resume_with_earliest: true,
    agent_priority: ['codex', 'claude_code'],
    unknown_reset_retry_secs: 600,
    keep_awake: true,
    accounts: [],
  };
  vi.mocked(rpc).mockImplementation(async (name, payload) => {
    if (name === 'get_limit_policy') return { ...saved };
    if (name === 'set_limit_policy') {
      saved = payload as LimitPolicy;
      return saved;
    }
    if (name === 'ensure_workbench_project') return { id: 'project' };
    return [];
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Capture />
      </StoreProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('policy persistence', () => {
  it('preserves two rapid toggles before the next render', async () => {
    await act(async () => {
      await Promise.all([
        store.savePolicy({ auto_switch: false }),
        store.savePolicy({ switch_back: false }),
      ]);
    });
    expect(saved.auto_switch).toBe(false);
    expect(saved.switch_back).toBe(false);
    expect(store.policy).toEqual(saved);
  });

  it('serializes writes and keeps optimistic preferences during a refresh', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const implementation = vi.mocked(rpc).getMockImplementation()!;
    let writes = 0;
    vi.mocked(rpc).mockImplementation(async (name, payload) => {
      if (name === 'set_limit_policy' && ++writes === 1) await gate;
      return implementation(name, payload);
    });
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = store.savePolicy({ auto_switch: false });
      second = store.savePolicy({ switch_back: false });
      await store.refresh();
    });
    expect(writes).toBe(1);
    expect(store.policy?.auto_switch).toBe(false);
    expect(store.policy?.switch_back).toBe(false);
    await act(async () => {
      release();
      await Promise.all([first, second]);
    });
    expect(writes).toBe(2);
    expect(saved.auto_switch).toBe(false);
    expect(saved.switch_back).toBe(false);
  });
});

describe('message submission', () => {
  it('submits once and preserves a draft entered while sending', async () => {
    let complete!: (success: boolean) => void;
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    const render = (text: string, seq: number) =>
      root.render(
        <Tooltip.Provider>
          <StoreProvider>
            <Composer
              draft={{ text, seq }}
              busy={false}
              onSend={onSend}
              onStop={() => {}}
              onCommand={() => {}}
              onNavigate={() => {}}
            />
          </StoreProvider>
        </Tooltip.Provider>,
      );
    await act(async () => render('First message', 1));
    const send = container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!;
    await act(async () => {
      send.click();
      send.click();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => render('Next draft', 2));
    await act(async () => complete(true));
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Next draft');
  });
});

describe('account creation', () => {
  it('does not create two accounts when Enter is submitted twice', async () => {
    const implementation = vi.mocked(rpc).getMockImplementation()!;
    vi.mocked(rpc).mockImplementation(async (name, payload) => {
      if (name === 'detect_agents') return [{ kind: 'codex', installed: true }];
      return implementation(name, payload);
    });
    await act(async () =>
      root.render(
        <Tooltip.Provider>
          <StoreProvider>
            <Accounts addOpen setAddOpen={() => {}} />
          </StoreProvider>
        </Tooltip.Provider>,
      ),
    );
    const name = document.querySelector<HTMLInputElement>('input[placeholder="Personal, Work…"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        name,
        'Test account',
      );
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = name.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(
      vi.mocked(rpc).mock.calls.filter(([method]) => method === 'set_limit_policy'),
    ).toHaveLength(1);
    expect(saved.accounts).toHaveLength(1);
  });

  it('saves a setup token once when Enter is submitted twice', async () => {
    saved.accounts = [
      {
        id: 'test-token',
        label: 'Token account',
        agent: 'claude_code',
        auth_mode: 'oauth_token',
        enabled: true,
        use_credits: false,
      },
    ];
    const implementation = vi.mocked(rpc).getMockImplementation()!;
    vi.mocked(rpc).mockImplementation(async (name, payload) => {
      if (name === 'provider_account_statuses')
        return [
          {
            id: 'test-token',
            label: 'Token account',
            agent: 'claude_code',
            auth_mode: 'oauth_token',
            enabled: true,
            use_credits: false,
            installed: true,
            authenticated: false,
            availability: 'unknown',
            active: false,
          },
        ];
      return implementation(name, payload);
    });
    await act(async () =>
      root.render(
        <Tooltip.Provider>
          <StoreProvider>
            <Accounts addOpen={false} setAddOpen={() => {}} />
          </StoreProvider>
        </Tooltip.Provider>,
      ),
    );
    const signIn = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Sign in',
    )!;
    await act(async () => signIn.click());
    const token = document.querySelector<HTMLInputElement>('input[aria-label="Setup token"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        token,
        'sk-ant-oat-test-placeholder-never-a-real-credential',
      );
      token.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      const form = token.closest('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(
      vi.mocked(rpc).mock.calls.filter(([method]) => method === 'set_provider_account_token'),
    ).toHaveLength(1);
  });
});
