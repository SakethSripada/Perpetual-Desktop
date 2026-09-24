import { describe, expect, it } from 'vitest';
import { commandPrompt, parseCommand } from './commands';
import { questionsFromEvent, formatQuestionAnswers } from './userQuestions';
import { buildTranscriptItems } from './transcript';
import type { AgentThreadEvent } from './types';
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
});
