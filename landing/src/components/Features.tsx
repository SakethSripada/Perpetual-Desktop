import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from './Reveal';
import { TiltCard } from './TiltCard';
import { Video } from './Video';

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-5 pb-28 sm:px-8 sm:pb-36">
      <Reveal className="mx-auto max-w-[1180px]">
        <h2 className="max-w-xl text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] text-balance sm:text-[52px]">
          <span className="headline-gradient">Built for the long runs.</span>
        </h2>
      </Reveal>

      <div className="mx-auto mt-10 grid max-w-[1180px] gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2 lg:row-span-2">
          <TiltCard className="h-full">
            <Copy
              title="Every account in one place"
              body="Sign in to as many Codex and Claude accounts as you have, set the order they’re used in, and see when each one resets."
            />
            <Screen
              name="accounts"
              start={1.6}
              label="Opening the account switcher, then the Accounts page with usage, reset times, and switching order"
            />
          </TiltCard>
        </Reveal>

        <Reveal delay={0.08}>
          <TiltCard className="h-full">
            <Copy
              title="Workflows"
              body="Chain tasks into a workflow, and choose the folder each step runs in."
            />
            <WorkflowSteps />
          </TiltCard>
        </Reveal>

        <Reveal delay={0.16}>
          <TiltCard className="h-full">
            <Copy
              title="Stays on your machine"
              body="No servers and no telemetry. Perpetual drives the CLIs you already have, with your code and sign-ins kept on your computer."
            />
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}

function Copy({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative z-10 p-7 pb-7 sm:p-8 sm:pb-8">
      <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-muted">{body}</p>
    </div>
  );
}

/** A recording shown as a window peeking in from the card's lower right. */
function Screen({ name, label, start }: { name: string; label: string; start?: number }) {
  return (
    <div className="relative mt-auto ml-7 aspect-[16/9.4] overflow-hidden rounded-tl-[12px] bg-[#1f1f1f] shadow-[0_0_0_1px_rgba(255,255,255,0.08),-20px_-10px_60px_-20px_rgba(0,0,0,0.6)] sm:ml-8">
      <Video name={name} label={label} start={start} className="absolute top-0 left-0 w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/80 to-transparent" />
    </div>
  );
}

const STEPS = [
  { task: 'Update the API types', folder: 'api-server' },
  { task: 'Regenerate the client', folder: 'web-app' },
  { task: 'Run the end-to-end tests', folder: 'web-app' },
];

type StepState = 'done' | 'running' | 'waiting';

function WorkflowSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [phase, setPhase] = useState<'running' | 'done' | 'reset'>('running');

  useEffect(() => {
    if (!inView || reduceMotion) return;

    const delay =
      phase === 'running'
        ? 1500
        : phase === 'reset'
          ? 400
          : activeStep === STEPS.length - 1
            ? 1400
            : 550;
    const timer = window.setTimeout(() => {
      if (phase === 'running') {
        setPhase('done');
      } else if (phase === 'reset') {
        setActiveStep(0);
        setPhase('running');
      } else if (activeStep === STEPS.length - 1) {
        setPhase('reset');
      } else {
        setActiveStep(activeStep + 1);
        setPhase('running');
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeStep, inView, phase, reduceMotion]);

  const stepState = (index: number): StepState => {
    if (reduceMotion) return 'done';
    if (phase === 'reset') return 'waiting';
    if (index < activeStep || (index === activeStep && phase === 'done')) return 'done';
    return index === activeStep ? 'running' : 'waiting';
  };

  return (
    <div ref={ref} className="relative my-auto px-7 pb-8 sm:px-8" aria-hidden>
      <div className="absolute top-5 bottom-14 left-[calc(1.75rem+11px)] w-px bg-white/15 sm:left-[calc(2rem+11px)]" />
      <ol className="relative space-y-3">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.task}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <StepDot state={stepState(i)} instant={!!reduceMotion} />
            <div className="min-w-0 flex-1 rounded-xl bg-[#202120] px-3.5 py-2.5 ring-1 ring-white/10">
              <div className="truncate text-[13.5px] text-ink">{s.task}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                <FolderIcon />
                {s.folder}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function StepDot({ state, instant }: { state: StepState; instant: boolean }) {
  return (
    <motion.span
      className="relative flex size-[23px] shrink-0 items-center justify-center rounded-full border"
      initial={false}
      animate={{
        backgroundColor: state === 'done' ? '#315b3e' : '#202120',
        borderColor:
          state === 'done' ? '#315b3e' : state === 'running' ? '#78917d' : 'rgba(255,255,255,0.2)',
      }}
      transition={{ duration: instant ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'running' && (
          <motion.span
            key="running"
            className="flex size-3 items-center justify-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18 }}
          >
            <motion.span
              className="block size-3 rounded-full border-2 border-[#58735f] border-t-[#b8dbc0]"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
            />
          </motion.span>
        )}
        {state === 'done' && (
          <motion.svg
            key="done"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c0dfc6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={instant ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: instant ? 0 : 0.2 }}
          >
            <motion.path
              d="M20 6L9 17l-5-5"
              initial={instant ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: instant ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

function FolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
