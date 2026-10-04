import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamingCaret } from './streamingCaret';
import { mergeThreadEvents, mergeSnapshot } from './streaming';
import type { AgentThreadEvent } from './types';

const event = (id: string, text: string, streaming = true): AgentThreadEvent => ({
  id,
  text,
  thread_id: 'thread',
  turn_id: 'turn',
  role: 'assistant',
  kind: 'assistant_message',
  data: { streaming },
  ts: '2026-10-04T00:00:00Z',
});

describe('stream updates', () => {
  it('lets history recover a missed completion without restoring its live caret', () => {
    const complete = event('live', 'Done', false);
    expect(mergeThreadEvents([complete], [event('live', 'Do')])).toEqual([complete]);
  });
  it('keeps the newest snapshot and the identity of unchanged history', () => {
    const older = event('old', 'Earlier', false);
    const final = event('live', 'Complete', false);
    expect(
      mergeThreadEvents([older, event('live', 'Com')], [event('live', 'Comple'), final]),
    ).toEqual([older, final]);
    expect(mergeThreadEvents([older], [final])[0]).toBe(older);
  });
  it('preserves live text and new events across a stale history response', () => {
    const live = event('live', 'Newer text');
    const next = event('next', 'Next message');
    expect(mergeThreadEvents([event('live', 'New')], [live, next])).toEqual([live, next]);
  });
});

describe('stream caret layout', () => {
  const render = (text: string) =>
    renderToStaticMarkup(
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[streamingCaret]}>
        {text}
      </Markdown>,
    );
  for (const text of [
    'Hello',
    'Hello **world**',
    '- First\n- Last',
    '> Quote',
    '# Heading',
    '```ts\nconst n = 1;\n```',
  ]) {
    it(`places the caret inside the final text block: ${text}`, () => {
      const html = render(text);
      expect(html.match(/class="stream-caret"/g)).toHaveLength(1);
      expect(html).toMatch(
        /<span class="stream-caret" aria-hidden="true"><\/span><\/(p|li|h1|code)>/,
      );
      expect(html).not.toContain('\n<span class="stream-caret"');
    });
  }
  it('does not create a standalone line for empty content or a horizontal rule', () => {
    expect(render('')).not.toContain('stream-caret');
    expect(render('Hello\n\n---')).not.toContain('stream-caret');
  });
});

describe('refresh races', () => {
  it('does not rewind cumulative text but accepts a shorter final correction', () => {
    expect(mergeThreadEvents([event('a', 'Hello world')], [event('a', 'Hello')])[0].text).toBe(
      'Hello world',
    );
    expect(mergeThreadEvents([event('a', 'Hello world')], [event('a', 'Hi', false)])[0].text).toBe(
      'Hi',
    );
  });
  it('retains updates and newly created tasks that arrive during a snapshot request', () => {
    expect(
      mergeSnapshot(
        [{ id: 'a', status: 'running' }],
        [
          { id: 'a', status: 'review' },
          { id: 'b', status: 'running' },
        ],
      ),
    ).toEqual([
      { id: 'a', status: 'review' },
      { id: 'b', status: 'running' },
    ]);
    expect(mergeSnapshot([], [])).toEqual([]);
  });
});
