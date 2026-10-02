// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { AgentModelCatalog, WorkGraph, WorkNode, WorkPlanRun } from '../lib/types';

const state = vi.hoisted(() => ({
  graph: null as WorkGraph | null,
  plans: [] as WorkPlanRun[],
  models: [] as AgentModelCatalog[],
  calls: [] as { name: string; payload: any }[],
}));

vi.mock('../lib/store', () => ({
  useStore: () => ({
    project: { id: 'project' },
    repos: [],
    models: state.models,
    revision: 0,
    refresh: async () => {},
  }),
}));
vi.mock('../lib/api', () => ({
  native: true,
  action: async (run: () => Promise<unknown>) => run(),
  rpc: async (name: string, payload: any) => {
    state.calls.push({ name, payload });
    if (name === 'get_work_graph') return structuredClone(state.graph);
    if (name === 'list_work_plan_runs') return structuredClone(state.plans);
    if (name === 'create_work_node') {
      const id = `new-${state.graph!.nodes.length}`;
      state.graph!.nodes.push({
        ...fixture(id, payload.parent_id),
        title: payload.title,
        kind: payload.kind,
      });
    }
    if (name === 'reorder_work_nodes') {
      payload.node_ids.forEach((id: string, index: number) => {
        state.graph!.nodes.find((n) => n.id === id)!.sort_order = index;
      });
    }
    if (name === 'move_work_node')
      state.graph!.nodes.find((n) => n.id === payload.node_id)!.parent_id = payload.parent_id;
    return undefined;
  },
}));
vi.mock('./AddFolder', () => ({ useAddFolder: () => ({ pick: async () => null, dialog: null }) }));
vi.mock('./ui', async () => {
  const React = await import('react');
  const box =
    (tag: string) =>
    ({ children, ...props }: any) =>
      React.createElement(tag, props, children);
  return {
    Button: ({ loading, children, ...props }: any) =>
      React.createElement('button', props, children),
    Card: box('div'),
    Dot: box('span'),
    Select: box('select'),
    ContextActions: ({ children }: any) => children,
    Empty: ({ title, action, children }: any) =>
      React.createElement('div', null, title, children, action),
    PageHeading: ({ title, actions }: any) => React.createElement('div', null, title, actions),
    MoreActions: ({ actions }: any) =>
      React.createElement(
        'div',
        null,
        actions.map((a: any) =>
          React.createElement(
            'button',
            { key: a.label, onClick: a.onSelect, disabled: a.disabled },
            a.label,
          ),
        ),
      ),
    Modal: ({ open, title, children, footer }: any) =>
      open ? React.createElement('div', { role: 'dialog' }, title, children, footer) : null,
    Confirm: () => null,
    Tip: ({ children }: any) => children,
    ProviderLogo: () => null,
    MenuRoot: box('div'),
    MenuTrigger: ({ children }: any) => children,
    MenuContent: () => null,
    MenuLabel: box('div'),
    MenuRadioGroup: box('div'),
    MenuRadioItem: box('div'),
    MenuSeparator: () => null,
    MenuItem: box('div'),
  };
});

import { Workflows } from './Workflows';

function fixture(id: string, parent_id: string | null): WorkNode {
  return {
    id,
    parent_id,
    project_id: 'project',
    task_id: null,
    thread_id: null,
    kind: 'group',
    title: id,
    description: null,
    status: 'draft',
    priority: 'medium',
    primary_agent: null,
    workflow_model: null,
    workflow_reasoning: null,
    workflow_permission: 'workspace_write',
    workflow_limit_behavior: 'inherit',
    position_x: 0,
    position_y: 0,
    sort_order: id === 'second' ? 1 : 0,
    created_at: id,
    updated_at: id,
  };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.calls = [];
  state.plans = [];
  state.models = [];
  state.graph = {
    project_id: 'project',
    nodes: [fixture('root', null), fixture('first', 'root'), fixture('second', 'root')],
    edges: [],
    repo_bindings: [],
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<Workflows onSelect={() => {}} />);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const click = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find(
    (el) => el.textContent?.trim() === label || el.title === `View subtasks of ${label}`,
  );
  expect(button, `button ${label}`).toBeTruthy();
  await act(async () => {
    button!.click();
  });
};

it('navigates to children, offers a group inside the current task, and reorders siblings through RPC', async () => {
  await click('root');
  expect(host.textContent).toContain('first');
  expect(host.textContent).toContain('second');
  await click('Move down');
  expect(
    state.calls.some(
      (call) => call.name === 'reorder_work_nodes' && call.payload.parent_id === 'root',
    ),
  ).toBe(true);
  await click('Group');
  expect(host.querySelector('[role=dialog]')?.textContent).toContain('Inside root');
});

it('saves task instructions, provider, access, and rate limit choice from the detail view', async () => {
  state.models = [
    {
      agent: 'claude_code',
      models: [
        { id: 'claude-test', label: 'Claude test', available: true, reasoning: ['low', 'high'] },
      ],
    },
  ] as AgentModelCatalog[];
  state.graph!.nodes[0].kind = 'session';
  state.graph!.nodes[0].thread_id = 'thread-root';
  await act(async () => {
    root.render(<Workflows key="settings" onSelect={() => {}} />);
  });
  await click('root');
  const user = userEvent.setup();
  const instructions = host.querySelector(
    'textarea[aria-label="Task instructions"]',
  ) as HTMLTextAreaElement;
  await act(async () => {
    await user.type(instructions, 'Do the work');
  });
  const select = (label: string) =>
    [...host.querySelectorAll('label')]
      .find((item) => item.textContent?.startsWith(label))!
      .querySelector('select')!;
  await act(async () => {
    await user.selectOptions(select('Agent'), 'claude_code');
  });
  await act(async () => {
    await user.selectOptions(select('Model'), 'claude-test');
    await user.selectOptions(select('Reasoning'), 'high');
  });
  await act(async () => {
    await user.selectOptions(select('Access'), 'ask');
  });
  await act(async () => {
    await user.selectOptions(select('At a rate limit'), 'wait');
  });
  await click('Save changes');
  expect(state.calls).toContainEqual(
    expect.objectContaining({
      name: 'update_work_node',
      payload: expect.objectContaining({
        node_id: 'root',
        patch: expect.objectContaining({
          description: 'Do the work',
          primary_agent: 'claude_code',
          workflow_model: 'claude-test',
          workflow_reasoning: 'high',
          workflow_permission: 'ask',
          workflow_limit_behavior: 'wait',
        }),
      }),
    }),
  );
});

it('starts the selected subtree and exposes resume and stop for a paused run', async () => {
  await click('root');
  await click('Run in order');
  expect(state.calls).toContainEqual({ name: 'start_workflow', payload: { root_node_id: 'root' } });
  state.plans = [
    {
      id: 'plan',
      project_id: 'project',
      root_node_id: 'root',
      state: 'paused',
      completed_count: 1,
      total_count: 2,
      error: 'Interrupted',
    } as WorkPlanRun,
  ];
  await act(async () => {
    root.render(<Workflows key="paused" onSelect={() => {}} />);
  });
  await click('root');
  expect(host.textContent).toContain('1 of 2 complete');
  await click('Resume');
  expect(state.calls).toContainEqual({
    name: 'resume_work_plan',
    payload: { plan_run_id: 'plan' },
  });
  await click('Stop');
  expect(state.calls).toContainEqual({ name: 'stop_work_plan', payload: { plan_run_id: 'plan' } });
});
