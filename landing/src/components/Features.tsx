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

      <div className="mx-auto mt-10 grid max-w-[1180px] gap-4 lg:grid-cols-6">
        <Reveal className="lg:col-span-4">
          <TiltCard className="h-full">
            <Copy
              tone="accent"
              icon={ICONS.accounts}
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

        <Reveal delay={0.08} className="lg:col-span-2">
          <TiltCard className="h-full">
            <Copy
              tone="teal"
              icon={ICONS.local}
              title="Stays on your machine"
              body="No servers and no telemetry. Perpetual drives the CLIs you already have, with your code and sign-ins kept on your computer."
            />
            <Orbit />
          </TiltCard>
        </Reveal>

        <Reveal className="lg:col-span-2">
          <TiltCard className="h-full">
            <Copy
              tone="violet"
              icon={ICONS.workflows}
              title="Workflows"
              body="Chain tasks into a workflow, and choose the folder each step runs in."
            />
            <WorkflowSteps />
          </TiltCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-4">
          <TiltCard className="h-full">
            <Copy
              tone="amber"
              icon={ICONS.approvals}
              title="You decide what runs"
              body="Pick how much each task may do on its own. Anything beyond that waits for you, with the exact command and why it’s needed."
            />
            <Screen
              name="approval"
              start={2.2}
              crop
              align="bottom"
              label="Claude asking to run npm install, then continuing once allowed"
            />
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}

const TONES = {
  accent: 'bg-accent/12 text-accent ring-accent/20',
  teal: 'bg-teal/12 text-teal ring-teal/20',
  violet: 'bg-[#a99bff]/12 text-[#b7abff] ring-[#a99bff]/20',
  amber: 'bg-warn/12 text-warn ring-warn/20',
} as const;

const ICONS = {
  accounts: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  local: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  workflows: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M6.5 10v3.5a2 2 0 0 0 2 2H14" />
    </>
  ),
  approvals: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

function Copy({
  title,
  body,
  icon,
  tone,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="relative z-10 p-7 pb-7 sm:p-8 sm:pb-8">
      <span
        className={`mb-5 flex size-9 items-center justify-center rounded-[10px] ring-1 ${TONES[tone]}`}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-muted">{body}</p>
    </div>
  );
}

/**
 * A recording shown as a window peeking in from the card's lower right.
 * `crop` trims the sidebar so the part that matters stays legible.
 */
function Screen({
  name,
  label,
  start,
  crop = false,
  align = 'top',
}: {
  name: string;
  label: string;
  start?: number;
  crop?: boolean;
  align?: 'top' | 'bottom';
}) {
  return (
    <div className="relative mt-auto ml-7 aspect-[16/8.6] overflow-hidden rounded-tl-[12px] bg-[#1f1f1f] shadow-[0_0_0_1px_rgba(255,255,255,0.08),-20px_-10px_60px_-20px_rgba(0,0,0,0.6)] sm:ml-8">
      <Video
        name={name}
        label={label}
        start={start}
        className={`absolute max-w-none ${crop ? 'left-[-24%] w-[124%]' : 'left-0 w-full'} ${align === 'bottom' ? 'bottom-0' : 'top-0'}`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/80 to-transparent" />
    </div>
  );
}

function Orbit() {
  return (
    <div
      className="relative flex min-h-[260px] flex-1 items-center justify-center [perspective:700px]"
      aria-hidden
    >
      <div className="absolute size-[270px] rounded-full [transform:rotateX(70deg)] ring-1 ring-white/10" />
      <div className="absolute size-[180px] rounded-full [transform:rotateX(70deg)] ring-1 ring-white/[0.06]" />
      <motion.div
        className="absolute size-[270px] [transform-style:preserve-3d]"
        style={{ rotateX: 70 }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
      >
        {[
          { src: '/brands/openai.svg', at: 'top-0 left-1/2' },
          { src: '/brands/claude.svg', at: 'bottom-0 left-1/2' },
        ].map((b) => (
          <motion.div
            key={b.src}
            className={`absolute ${b.at} -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]`}
            animate={{ rotateZ: -360 }}
            transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-[#232423] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_24px_-8px_rgba(0,0,0,0.9)] [transform:rotateX(-70deg)]">
              <img src={b.src} alt="" className="size-4" />
            </div>
          </motion.div>
        ))}
      </motion.div>
      <img
        src="/icon.png"
        alt=""
        className="relative size-[88px] drop-shadow-[0_18px_30px_rgba(0,0,0,0.7)]"
      />
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
      <span className="relative flex size-[23px] shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-accent/40">
        <span className="size-2 animate-pulse rounded-full bg-accent" />
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
