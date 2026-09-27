/*
 * Agent activity primitives: pixel loader, shimmer text, tool-run trace, and
 * the question card. Adapted from Beautiful UI (https://www.beautifului.dev),
 * MIT License, Copyright (c) 2026 Shane Levine. See licenses/beautiful-ui.txt.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { AgentThreadEvent } from '../lib/types';
import { shellCommand } from '../lib/format';
import type { UserQuestion } from '../lib/userQuestions';
import { cn } from './ui';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

// ---- Loader ------------------------------------------------------------------

/** A chevron wavefront driving right across a 3×3 grid. */
const CHEVRON = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return (col + Math.abs(row - 1)) * 90;
});

export function LoaderGrid({ size = 4, round = false }: { size?: number; round?: boolean }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0"
      style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap: size * 0.375 }}
    >
      {CHEVRON.map((delay, index) => (
        <span
          key={index}
          className={cn('pixel-cell bg-ink', round ? 'rounded-full' : 'rounded-[1px]')}
          style={{
            width: size,
            height: size,
            opacity: 0.15,
            animation: `pixel-on 650ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Text with a light sweeping across it while work is in progress. */
export function ShimmerText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('bg-clip-text whitespace-nowrap text-transparent', className)}
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--faint) 35%, var(--ink) 50%, var(--faint) 65%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-text 1.4s linear infinite',
      }}
    >
      {children}
    </span>
  );
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

/** Live time since `since`, in tabular mono figures. */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="font-mono text-[12px] text-faint tabular-nums">
      {formatElapsed(Math.max(0, (now - since) / 1000))}
    </span>
  );
}

/** The status line shown while an agent works: loader, label, elapsed time. */
export function LoadingState({ label, since }: { label: string; since: number }) {
  return (
    <div role="status" className="flex w-fit items-center gap-2.5">
      <LoaderGrid />
      <ShimmerText className="text-[13px] font-medium">{label}</ShimmerText>
      <Elapsed since={since} />
    </div>
  );
}

// ---- Tool run ------------------------------------------------------------------

const ICONS: Record<string, ReactNode> = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
  write: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  run: <path d="M4 17l6-5-6-5M12 19h8" />,
  read: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
};

type Step = {
  id: string;
  callId: string | null;
  done: boolean;
  icon: keyof typeof ICONS;
  label: string;
  chip: string | null;
  mono: boolean;
  detail: string[];
  failed: boolean;
};

type FileChip = { path: string; change: 'added' | 'deleted' | 'modified' };

function toolKind(name: string): { icon: keyof typeof ICONS; label: string } {
  const n = name.toLowerCase();
  if (/read|view|open|cat\b|get-content/.test(n)) return { icon: 'read', label: 'Read' };
  if (/edit|write|patch|create|replace|multiedit/.test(n)) return { icon: 'write', label: 'Edit' };
  if (/grep|glob|search|find|list|ls\b/.test(n)) return { icon: 'search', label: 'Search' };
  if (/think|reason|plan|todo/.test(n)) return { icon: 'think', label: name };
  return { icon: 'run', label: /command|bash|shell|exec|run/.test(n) ? 'Run' : name };
}

function inputTarget(input: Record<string, unknown>) {
  const raw = Array.isArray(input.command)
    ? input.command.join(' ')
    : typeof input.command === 'string'
      ? input.command
      : null;
  if (raw) return { text: shellCommand(raw), mono: true };
  for (const key of ['file_path', 'path', 'pattern', 'url', 'query', 'description']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim())
      return { text: value, mono: key !== 'description' };
  }
  return null;
}

/** Pairs each tool call with the result that follows it, and collects file edits. */
export function toolRun(events: AgentThreadEvent[]) {
  const steps: Step[] = [];
  const files = new Map<string, FileChip>();
  for (const event of events) {
    const data = (event.data ?? {}) as Record<string, unknown>;
    if (event.kind === 'file_changed') {
      const text = event.text ?? '';
      const space = text.indexOf(' ');
      const path = space > 0 ? text.slice(space + 1) : text;
      const verb = text.slice(0, Math.max(space, 0)).toLowerCase();
      files.set(path, {
        path,
        change: /add|creat|new/.test(verb)
          ? 'added'
          : /delet|remov/.test(verb)
            ? 'deleted'
            : 'modified',
      });
      continue;
    }
    if (event.kind === 'tool_result') {
      // Pair by the provider's call id; older events without one fall back
      // to the earliest call still waiting for a result.
      const callId = typeof data.call_id === 'string' ? data.call_id : null;
      const step = callId ? steps.find((s) => s.callId === callId) : steps.find((s) => !s.done);
      if (step) {
        const summary = String(data.summary ?? event.text ?? '').trim();
        step.detail = summary ? summary.split(/\r?\n/).filter(Boolean).slice(0, 8) : [];
        step.failed = data.ok === false;
        step.done = true;
      }
      continue;
    }
    const { icon, label } = toolKind(event.text || 'Tool');
    const target = inputTarget((data.input ?? {}) as Record<string, unknown>);
    steps.push({
      id: event.id,
      callId: typeof data.call_id === 'string' ? data.call_id : null,
      done: false,
      icon,
      label,
      chip: target?.text ?? null,
      mono: target?.mono ?? false,
      detail: [],
      failed: false,
    });
  }
  return { steps, files: [...files.values()] };
}

function Chevron({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-200"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300"
      style={{
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transitionTimingFunction: EASE,
      }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function ToolRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const expandable = step.detail.length > 0;
  return (
    <div style={{ animation: `fade-up 300ms ${EASE} both` }}>
      <button
        type="button"
        aria-expanded={open}
        disabled={!expandable}
        onClick={() => setOpen((v) => !v)}
        className="group/row -mx-[3px] flex h-7 w-[calc(100%+6px)] min-w-0 items-center gap-2 rounded-md px-[3px] text-left transition-colors duration-100 enabled:hover:bg-hover"
      >
        <span
          className={cn(
            'relative flex size-4 shrink-0 items-center justify-center',
            step.failed ? 'text-danger' : 'text-faint',
          )}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={step.icon === 'think' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'transition-opacity duration-100',
              expandable && 'group-hover/row:opacity-0',
              open && 'opacity-0',
            )}
          >
            {ICONS[step.icon]}
          </svg>
          {expandable && (
            <span
              className={cn(
                'absolute transition-opacity duration-150 group-hover/row:opacity-100',
                open ? 'opacity-100' : 'opacity-0',
              )}
            >
              <Chevron open={open} />
            </span>
          )}
        </span>
        <span className="shrink-0 text-[12.5px] font-medium text-ink">{step.label}</span>
        {step.chip && (
          <span
            title={step.chip}
            className={cn(
              'inline-flex h-[22px] min-w-0 items-center truncate rounded-md bg-hover px-1.5 text-[11.5px] text-muted ring-1 ring-line/60',
              step.mono && 'font-mono',
            )}
          >
            <span className="truncate">{step.chip}</span>
          </span>
        )}
        {step.failed && <span className="shrink-0 text-[11px] text-danger">Failed</span>}
      </button>
      <Collapse open={open}>
        <div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-l border-line py-0.5 pl-3.5">
          {step.detail.map((line, index) => (
            <span
              key={index}
              className={cn(
                'truncate font-mono text-[11.5px] leading-[1.6] selectable',
                step.failed ? 'text-danger' : 'text-muted',
              )}
            >
              {line}
            </span>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * One stretch of agent work between messages: an expandable list of tool
 * calls and chips for the files it changed. While live, the header shimmers.
 */
export function ToolRun({
  events,
  live,
  onOpenFiles,
}: {
  events: AgentThreadEvent[];
  live: boolean;
  onOpenFiles?: () => void;
}) {
  const { steps, files } = toolRun(events);
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? live;
  const calls = steps.length;
  const summary = [
    calls > 0 && `Ran ${calls} ${calls === 1 ? 'tool' : 'tools'}`,
    files.length > 0 && `changed ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
  ]
    .filter(Boolean)
    .join(', ');
  const current = steps[steps.length - 1];
  const activeLabel =
    current?.icon === 'read'
      ? 'Reading'
      : current?.icon === 'write'
        ? 'Editing'
        : current?.icon === 'search'
          ? 'Searching'
          : current?.icon === 'run'
            ? 'Running a command'
            : 'Working';
  return (
    <div className="my-3 w-full max-w-[560px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setManual(!open)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-100 hover:bg-hover"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={live ? 'var(--muted)' : 'var(--faint)'}
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        {live ? (
          <ShimmerText className="text-[12.5px] font-medium">{activeLabel}</ShimmerText>
        ) : (
          <span
            className="text-[12.5px] font-medium text-muted"
            style={{ animation: 'fade-in 350ms ease-out both' }}
          >
            {summary || 'Worked'}
          </span>
        )}
        {steps.some((s) => s.failed) && !live && (
          <span className="text-[11px] text-danger">· some steps failed</span>
        )}
        <span className="text-faint">
          <Chevron open={open} />
        </span>
      </button>
      <Collapse open={open}>
        <div className="relative mt-1 ml-[5px] pl-4">
          <span aria-hidden className="absolute top-0 bottom-1 left-[3px] w-px bg-line" />
          <div className="flex flex-col gap-0.5 py-1">
            {steps.map((step) => (
              <ToolRow key={step.id} step={step} />
            ))}
          </div>
        </div>
      </Collapse>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((file, index) => {
            const slash = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
            return (
              <button
                key={file.path}
                type="button"
                title={`${file.path} · open Changes`}
                onClick={onOpenFiles}
                className="inline-flex h-7 max-w-full items-center gap-2 rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-ink shadow-sm transition-colors duration-100 hover:bg-hover"
                style={{ animation: `bui-pop-in 250ms ${EASE} ${index * 60}ms both` }}
              >
                <span className="min-w-0 truncate">{file.path.slice(slash + 1)}</span>
                <span
                  className={cn(
                    'shrink-0 font-sans text-[10.5px]',
                    file.change === 'added'
                      ? 'text-success'
                      : file.change === 'deleted'
                        ? 'text-danger'
                        : 'text-faint',
                  )}
                >
                  {file.change === 'added'
                    ? 'new'
                    : file.change === 'deleted'
                      ? 'deleted'
                      : 'edited'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Question card -------------------------------------------------------------

const ROLL_MS = 400;
const SLIDE = `360ms cubic-bezier(0.22, 1, 0.36, 1)`;

/** Odometer digits: each character that changes rolls up or down. */
function RollingDigits({ value }: { value: string }) {
  const prev = useRef(value);
  const [oldVal, setOldVal] = useState(value);
  const [newVal, setNewVal] = useState(value);
  const [rolling, setRolling] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [dir, setDir] = useState<'up' | 'down'>('up');
  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const fromN = parseInt(from, 10);
    const toN = parseInt(value, 10);
    setDir(Number.isFinite(fromN) && Number.isFinite(toN) && toN < fromN ? 'down' : 'up');
    setOldVal(from);
    setNewVal(value);
    setRolling(true);
    setShifted(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShifted(true));
    });
    const done = setTimeout(() => {
      setRolling(false);
      setOldVal(value);
      setShifted(false);
    }, ROLL_MS);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [value]);
  const chars = rolling ? newVal : oldVal;
  return (
    <>
      {Array.from({ length: chars.length }, (_, i) => {
        const o = oldVal[i] ?? '';
        const n = chars[i] ?? '';
        if (!rolling || o === n) return <span key={`${i}-${n}`}>{n}</span>;
        const top = dir === 'down' ? n : o;
        const bottom = dir === 'down' ? o : n;
        return (
          <span
            key={`${i}-${o}-${n}-${dir}`}
            style={{
              display: 'inline-block',
              position: 'relative',
              overflow: 'hidden',
              height: '1em',
              lineHeight: '1em',
              verticalAlign: '-0.05em',
            }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translateY(${shifted ? (dir === 'down' ? '0' : '-1em') : dir === 'down' ? '-1em' : '0'})`,
              }}
            >
              <span style={{ height: '1em', lineHeight: '1em' }}>{top}</span>
              <span style={{ height: '1em', lineHeight: '1em' }}>{bottom}</span>
            </span>
          </span>
        );
      })}
    </>
  );
}

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

export function SentPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/12 py-1 pr-2.5 pl-1 text-[12.5px] font-medium text-success"
      style={{ animation: `bui-pop-in 260ms ${EASE} both` }}
    >
      <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-white">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      {children}
    </span>
  );
}

/**
 * The agent's questions, one at a time. The stack slides between questions,
 * the counter rolls, and single-choice answers advance on their own.
 */
export function QuestionCard({
  questions,
  answered,
  onSubmit,
}: {
  questions: UserQuestion[];
  /** The conversation already moved past these questions. */
  answered?: boolean;
  onSubmit: (answers: Record<string, string[]>) => Promise<void>;
}) {
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const measured = useRef(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [trackY, setTrackY] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [ready, setReady] = useState(false);

  const last = qi === questions.length - 1;
  const hasAnswer = (picked[qi]?.length ?? 0) > 0 || Boolean(custom[qi]?.trim());

  const sync = (withAnim: boolean) => {
    const item = refs.current[qi];
    if (!item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setHeight(item.offsetHeight);
    setTrackY(item.offsetTop);
    setAnimate(withAnim && !reduce);
  };
  useLayoutEffect(() => {
    const withAnim = measured.current;
    measured.current = true;
    sync(withAnim);
    setReady(true);
  }, [qi, picked, custom]);
  useEffect(() => () => void (advanceTimer.current && clearTimeout(advanceTimer.current)), []);

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setQi(Math.min(Math.max(next, 0), questions.length - 1));
  };
  const send = async () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const answers = Object.fromEntries(
      questions.map((q, i) => {
        const chosen = (picked[i] ?? []).map((index) => q.options[index]?.label).filter(Boolean);
        const other = custom[i]?.trim();
        const all = other ? [...chosen, other] : chosen;
        return [q.id, all.length ? all : ['No preference']];
      }),
    );
    setSending(true);
    try {
      await onSubmit(answers);
      setSent(true);
    } finally {
      setSending(false);
    }
  };
  const advance = () => (last ? void send() : goTo(qi + 1));
  const toggle = (index: number) => {
    const multi = questions[qi].multiSelect;
    setPicked((current) => {
      const now = current[qi] ?? [];
      const next = !multi
        ? [index]
        : now.includes(index)
          ? now.filter((i) => i !== index)
          : [...now, index];
      return { ...current, [qi]: next };
    });
    if (!multi) {
      setCustom((current) => ({ ...current, [qi]: '' }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => (last ? void send() : setQi((q) => q + 1)), 480);
    }
  };

  if (sent || answered)
    return (
      <div className="my-4">
        <SentPill>{sent ? 'Answer sent' : 'Answered'}</SentPill>
      </div>
    );

  return (
    <div className="my-5 w-full max-w-[460px]">
      <div
        className="relative overflow-hidden rounded-2xl border border-line bg-elevated shadow-[0_10px_40px_-24px_rgba(0,0,0,0.55)]"
        style={{ animation: `fade-up 380ms ${EASE} both` }}
      >
        <div className="px-4 pt-4 pb-3">
          <div
            className="overflow-hidden"
            style={{ height, transition: animate ? `height ${SLIDE}` : undefined }}
            aria-live="polite"
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 26,
                transform: `translate3d(0, ${-trackY}px, 0)`,
                transition: animate ? `transform ${SLIDE}` : undefined,
                willChange: 'transform',
              }}
            >
              {questions.map((question, index) => {
                const active = index === qi;
                if (!ready && !active) return null;
                const chosen = picked[index] ?? [];
                const style: CSSProperties = {
                  opacity: active ? 1 : 0,
                  transition: animate ? `opacity ${SLIDE}` : undefined,
                  pointerEvents: active ? undefined : 'none',
                };
                return (
                  <div
                    key={question.id}
                    ref={(el) => void (refs.current[index] = el)}
                    aria-hidden={active ? undefined : true}
                    style={style}
                  >
                    <div className="text-[14px] font-medium text-ink">{question.question}</div>
                    <div className="mt-2.5 flex flex-col gap-0.5">
                      {question.options.map((option, i) => {
                        const on = chosen.includes(i);
                        return (
                          <button
                            key={option.label}
                            type="button"
                            aria-pressed={on}
                            tabIndex={active ? 0 : -1}
                            disabled={sending}
                            onClick={() => active && toggle(i)}
                            className="flex items-start gap-2 rounded-md py-1.5 pr-2 pl-1 text-left transition-colors duration-100 hover:bg-hover"
                          >
                            <span
                              className={cn(
                                'mt-px flex size-4 shrink-0 items-center justify-center transition-colors duration-200',
                                question.multiSelect ? 'rounded-[5px]' : 'rounded-full',
                                on
                                  ? 'bg-ink text-surface'
                                  : 'text-transparent shadow-[inset_0_0_0_1.5px_var(--faint)]',
                              )}
                            >
                              {question.multiSelect ? (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              ) : (
                                <span
                                  className="size-1.5 rounded-full bg-surface transition-transform duration-200"
                                  style={{ transform: on ? 'scale(1)' : 'scale(0)' }}
                                />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  'block text-[13px] leading-4 transition-colors duration-200',
                                  on ? 'text-ink' : 'text-muted',
                                )}
                              >
                                {option.label}
                              </span>
                              {option.description && (
                                <span className="mt-0.5 block text-[11.5px] leading-4 text-faint">
                                  {option.description}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                      <input
                        value={custom[index] ?? ''}
                        tabIndex={active ? 0 : -1}
                        onChange={(e) => {
                          if (!active) return;
                          setCustom((c) => ({ ...c, [index]: e.target.value }));
                          if (!question.multiSelect) setPicked((p) => ({ ...p, [index]: [] }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && hasAnswer) {
                            e.preventDefault();
                            advance();
                          }
                        }}
                        placeholder={question.options.length ? 'Something else…' : 'Your answer'}
                        aria-label="Your own answer"
                        className="!h-8 !border-transparent !bg-transparent !pl-1.5 text-[13px] focus:!border-line"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3 py-2.5">
          <div className="flex items-center gap-1 text-faint">
            {questions.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={qi <= 0}
                  onClick={() => goTo(qi - 1)}
                  className="flex size-[18px] items-center justify-center rounded-[5px] enabled:hover:text-ink disabled:opacity-30"
                >
                  <Arrow up />
                </button>
                <span
                  className="inline-flex items-center text-[12px] font-medium tabular-nums"
                  style={{ lineHeight: 1 }}
                >
                  <RollingDigits value={`${qi + 1} / ${questions.length}`} />
                </span>
                <button
                  type="button"
                  aria-label="Next question"
                  disabled={last}
                  onClick={() => goTo(qi + 1)}
                  className="flex size-[18px] items-center justify-center rounded-[5px] enabled:hover:text-ink disabled:opacity-30"
                >
                  <Arrow />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={sending}
              onClick={() => (last ? void send() : goTo(qi + 1))}
              className="h-7 rounded-full px-3 text-[12.5px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              Skip
            </button>
            <button
              type="button"
              disabled={!hasAnswer || sending}
              onClick={advance}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-35"
            >
              {last ? 'Send' : 'Continue'}
              <span className="text-[11px] opacity-60">⏎</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
