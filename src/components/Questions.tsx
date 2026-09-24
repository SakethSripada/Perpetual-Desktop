import { useState } from 'react';
import { Check } from 'lucide-react';
import { questionsFromEvent, formatQuestionAnswers } from '../lib/userQuestions';
import type { AgentThreadEvent } from '../lib/types';
import { Button } from './ui';
import { toast } from 'sonner';
export function Questions({
  event,
  onAnswer,
}: {
  event: AgentThreadEvent;
  onAnswer: (text: string) => Promise<void>;
}) {
  const questions = questionsFromEvent(event);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState(false);
  if (!questions.length) return null;
  return (
    <section className="my-5 rounded-xl border border-line p-5">
      {questions.map((q) => (
        <fieldset key={q.id} disabled={sent} className="mb-5">
          <legend className="mb-3 text-sm font-medium">{q.question}</legend>
          {q.options.map((option) => (
            <label
              key={option.label}
              className="mb-2 flex items-start gap-3 rounded-lg border border-line/60 p-3 text-sm"
            >
              <input
                type={q.multiSelect ? 'checkbox' : 'radio'}
                name={q.id}
                checked={(answers[q.id] || []).includes(option.label)}
                onChange={(e) =>
                  setAnswers((old) => ({
                    ...old,
                    [q.id]: q.multiSelect
                      ? e.target.checked
                        ? [...(old[q.id] || []), option.label]
                        : (old[q.id] || []).filter((v) => v !== option.label)
                      : [option.label],
                  }))
                }
              />
              <span>
                {option.label}
                <span className="mt-1 block text-xs text-muted">{option.description}</span>
              </span>
            </label>
          ))}
          <input
            aria-label={`Custom answer: ${q.header}`}
            className="mt-2 w-full"
            placeholder="Or write your own answer…"
            onChange={(e) => setAnswers((old) => ({ ...old, [q.id]: [e.target.value] }))}
          />
        </fieldset>
      ))}
      <Button
        variant="solid"
        disabled={sent || questions.some((q) => !answers[q.id]?.some(Boolean))}
        onClick={async () => {
          try {
            await onAnswer(formatQuestionAnswers(questions, answers));
            setSent(true);
          } catch (error) {
            toast.error(String(error));
          }
        }}
      >
        {sent ? (
          <>
            <Check size={14} />
            Answer sent
          </>
        ) : (
          'Send answer'
        )}
      </Button>
    </section>
  );
}
