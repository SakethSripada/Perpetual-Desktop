import { useState } from 'react';
import { Check, MessageCircleQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { questionsFromEvent, formatQuestionAnswers } from '../lib/userQuestions';
import { errorMessage } from '../lib/format';
import type { AgentThreadEvent } from '../lib/types';
import { Button, cn } from './ui';

/** Multiple-choice questions an agent asks mid-task. */
export function Questions({
  event,
  onAnswer,
}: {
  event: AgentThreadEvent;
  onAnswer: (text: string) => Promise<void>;
}) {
  const questions = questionsFromEvent(event);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  if (!questions.length) return null;
  const answers = Object.fromEntries(
    questions.map((q) => [
      q.id,
      [...(picked[q.id] ?? []), custom[q.id]?.trim() ?? ''].filter(Boolean),
    ]),
  );
  const complete = questions.every((q) => answers[q.id].length > 0);
  const toggle = (id: string, label: string, multi: boolean) =>
    setPicked((old) => {
      const current = old[id] ?? [];
      if (!multi) return { ...old, [id]: current[0] === label ? [] : [label] };
      return {
        ...old,
        [id]: current.includes(label) ? current.filter((v) => v !== label) : [...current, label],
      };
    });
  return (
    <section className="my-5 rounded-2xl border border-line bg-elevated/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
        <MessageCircleQuestion size={14} />
        {sent ? 'Answered' : 'Needs your input'}
      </div>
      {questions.map((q) => (
        <fieldset key={q.id} disabled={sent || sending} className="mb-4 last:mb-3">
          <legend className="mb-2 text-[13px] font-medium">{q.question}</legend>
          <div className="grid gap-1.5">
            {q.options.map((option) => {
              const on = (picked[q.id] ?? []).includes(option.label);
              return (
                <button
                  type="button"
                  key={option.label}
                  onClick={() => toggle(q.id, option.label, q.multiSelect)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-default',
                    on ? 'border-accent bg-accent/5' : 'border-line enabled:hover:bg-hover',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                      q.multiSelect ? 'rounded' : 'rounded-full',
                      on ? 'border-accent bg-accent text-on-accent' : 'border-muted/60',
                    )}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span>
                    {option.label}
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-muted">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <input
            aria-label={`Other answer: ${q.header}`}
            className="mt-2 w-full"
            placeholder={q.options.length ? 'Something else…' : 'Your answer'}
            value={custom[q.id] ?? ''}
            onChange={(e) => setCustom((old) => ({ ...old, [q.id]: e.target.value }))}
          />
        </fieldset>
      ))}
      {!sent && (
        <Button
          variant="primary"
          size="sm"
          loading={sending}
          disabled={!complete}
          onClick={async () => {
            setSending(true);
            try {
              await onAnswer(formatQuestionAnswers(questions, answers));
              setSent(true);
            } catch (error) {
              toast.error(errorMessage(error));
            } finally {
              setSending(false);
            }
          }}
        >
          Send answer
        </Button>
      )}
    </section>
  );
}
