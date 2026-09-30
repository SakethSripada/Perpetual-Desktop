import { describe, expect, it } from 'vitest';
import { commandPrompt, parseCommand } from './commands';
import { questionsFromEvent, formatQuestionAnswers } from './userQuestions';
import { buildTranscriptItems } from './transcript';
import { toolRun } from '../components/ai';
import { accountDetail, accountName, accountState, shellCommand } from './format';
import type { AgentThreadEvent, ProviderAccountStatus } from './types';
const event = (patch: Partial<AgentThreadEvent>): AgentThreadEvent => ({
  id: 'e1',
  thread_id: 't1',
  turn_id: 'turn1',
  role: 'tool',
  kind: 'tool_use',
  text: null,
  data: {},
  ts: '2026-09-22T00:00:00Z',
  ...patch,
});
describe('desktop commands', () => {
  it('preserves provider commands it does not own', () =>
    expect(parseCommand('/provider-custom foo')).toBeNull());
  it('recognizes aliases and multiline arguments', () =>
    expect(parseCommand('/code-review first\nsecond')).toEqual({
      name: 'review',
      argument: 'first\nsecond',
    }));
  it('keeps planning and reviews read only in the prompt', () => {
    for (const command of ['plan', 'review', 'security-review'])
      expect(commandPrompt(command, 'task', 'codex')).toMatch(/not modify files/i);
  });
  it('uses provider-specific guidance files', () => {
    expect(commandPrompt('init', '', 'codex')).toContain('AGENTS.md');
    expect(commandPrompt('init', '', 'claude_code')).toContain('CLAUDE.md');
  });
});
describe('provider continuity UI', () => {
  it('parses provider question variants without dropping options', () => {
    const questions = questionsFromEvent(
      event({
        text: 'request_user_input',
        data: {
          questions: [
            {
              id: 'q',
              header: 'Scope',
              question: 'Which scope?',
              options: [{ label: 'Small', description: 'One file' }],
              multi_select: true,
            },
          ],
        },
      }),
    );
    expect(questions[0].multiSelect).toBe(true);
    expect(formatQuestionAnswers(questions, { q: ['Small', 'Custom'] })).toBe('Small, Custom');
  });
  it('does not render token telemetry as chat messages', () => {
    const items = buildTranscriptItems({
      thread: null,
      events: [
        event({ kind: 'token_usage' }),
        event({ id: 'e2', role: 'assistant', kind: 'message', text: 'Done' }),
      ],
      activities: [],
      queued: [],
      cloudRuns: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('event');
  });
  it('hides Perpetual context reads while keeping other tool work visible', () => {
    const items = buildTranscriptItems({
      thread: null,
      events: [
        event({ id: 'a', data: { call_id: 'setup', input: { command: 'cat TASK_CONTEXT.md' } } }),
        event({
          id: 'b',
          kind: 'tool_result',
          data: { call_id: 'setup', summary: 'Internal notes' },
        }),
        event({ id: 'c', data: { call_id: 'work', input: { command: 'git status' } } }),
        event({ id: 'd', kind: 'tool_result', data: { call_id: 'work', summary: 'Clean' } }),
      ],
      activities: [],
      queued: [],
      cloudRuns: [],
    });
    expect(items.filter((item) => item.type === 'event').map((item) => item.event.id)).toEqual([
      'c',
      'd',
    ]);
  });
});
describe('account continuity', () => {
  const activity = (kind: string, payload: unknown) => ({
    id: 'a1',
    project_id: null,
    task_id: 't1',
    kind,
    payload,
    ts: '2026-09-22T00:00:01Z',
  });
  it('names the account a task switched to', () => {
    const items = buildTranscriptItems({
      thread: null,
      events: [],
      activities: [
        activity('thread.account_switched', {
          thread_id: 't1',
          from_agent: 'codex',
          to_agent: 'codex',
          account_id: 'work',
        }),
      ],
      queued: [],
      cloudRuns: [],
      accountLabel: (id) => (id === 'work' ? 'work@example.com' : null),
    });
    expect(items).toEqual([
      expect.objectContaining({
        type: 'transition',
        text: 'Account limit reached; continuing with work@example.com',
      }),
    ]);
  });
  it('shows provider errors but hides other system envelopes', () => {
    const items = buildTranscriptItems({
      thread: null,
      events: [
        event({ id: 'e1', role: 'system', kind: 'error', text: 'Codex exited unexpectedly' }),
        event({ id: 'e2', role: 'system', kind: 'awaiting_approval', text: 'waiting' }),
      ],
      activities: [],
      queued: [],
      cloudRuns: [],
    });
    expect(items.map((item) => item.type === 'event' && item.event.kind)).toEqual(['error']);
  });
  it('describes account state the way people read it', () => {
    const account = (patch: Partial<ProviderAccountStatus>): ProviderAccountStatus => ({
      id: 'a',
      label: 'Work',
      agent: 'codex',
      enabled: true,
      use_credits: false,
      auth_mode: 'isolated_cli',
      installed: true,
      active: false,
      authenticated: true,
      availability: 'available',
      reset_at: null,
      detail: null,
      ...patch,
    });
    expect(accountState(account({ active: true }))).toBe('active');
    expect(accountState(account({ availability: 'limited' }))).toBe('limited');
    expect(accountState(account({ authenticated: false }))).toBe('signed_out');
    expect(accountState(account({ installed: false }))).toBe('missing');
    expect(accountName(account({ email: 'me@example.com' }))).toBe('me@example.com');
    expect(accountName(account({ auth_mode: 'system' }))).toBe('Codex sign-in');
    expect(accountDetail(account({ auth_mode: 'system', plan: 'prolite' }))).toBe(
      'Shared with Codex CLI · Pro Lite',
    );
  });
});
describe('tool steps', () => {
  it('shows the command without its shell wrapper', () => {
    expect(
      shellCommand(
        String.raw`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -LiteralPath AGENTS.md'`,
      ),
    ).toBe('Get-Content -LiteralPath AGENTS.md');
    expect(shellCommand("bash -lc 'npm test'")).toBe('npm test');
    expect(shellCommand('git status')).toBe('git status');
  });
});
describe('tool runs', () => {
  it('pairs results with their calls by id, even out of order', () => {
    const { steps } = toolRun([
      event({
        id: 'a',
        kind: 'tool_use',
        text: 'Command',
        data: { call_id: '1', input: { command: 'ls' } },
      }),
      event({
        id: 'b',
        kind: 'tool_use',
        text: 'Command',
        data: { call_id: '2', input: { command: 'rg x' } },
      }),
      event({
        id: 'c',
        kind: 'tool_result',
        data: { call_id: '2', ok: false, summary: 'rg: not found' },
      }),
      event({ id: 'd', kind: 'tool_result', data: { call_id: '1', ok: true, summary: 'a.txt' } }),
    ]);
    expect(steps.map((s) => [s.chip, s.failed, s.detail[0]])).toEqual([
      ['ls', false, 'a.txt'],
      ['rg x', true, 'rg: not found'],
    ]);
  });
});
