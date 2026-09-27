import { motion } from 'motion/react';
import type { ReactNode } from 'react';
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
  { task: 'Update the API types', folder: 'northwind-api' },
  { task: 'Regenerate the client', folder: 'northwind-web' },
  { task: 'Run the end-to-end tests', folder: 'northwind-web' },
];

function WorkflowSteps() {
  return (
    <div className="relative my-auto px-7 pb-8 sm:px-8" aria-hidden>
      <div className="absolute top-5 bottom-14 left-[calc(1.75rem+11px)] w-px bg-white/10 sm:left-[calc(2rem+11px)]" />
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
            <StepDot state={i === 0 ? 'done' : i === 1 ? 'running' : 'waiting'} />
            <div className="min-w-0 flex-1 rounded-xl bg-white/[0.03] px-3.5 py-2.5 ring-1 ring-line">
              <div className="truncate text-[13.5px] text-ink/90">{s.task}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-faint">
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

function StepDot({ state }: { state: 'done' | 'running' | 'waiting' }): ReactNode {
  if (state === 'done')
    return (
      <span className="flex size-[23px] shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  if (state === 'running')
    return (
      <span className="relative flex size-[23px] shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-sage/40">
        <span className="size-2 animate-pulse rounded-full bg-sage" />
      </span>
    );
  return <span className="size-[23px] shrink-0 rounded-full bg-card ring-1 ring-white/12" />;
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
