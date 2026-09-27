import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { REPO } from '../lib/site';
import { DownloadButton } from './DownloadButton';
import { GithubLogo } from './Mark';
import { Video } from './Video';

const EASE = [0.16, 1, 0.3, 1] as const;

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 1.1, delay, ease: EASE },
  };
}

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  // The window leans back at rest and comes forward as you scroll.
  const rotateX = useTransform(smooth, [0, 0.42], [reduce ? 0 : 22, 0]);
  const scale = useTransform(smooth, [0, 0.42], [reduce ? 1 : 0.9, 1]);
  const lift = useTransform(smooth, [0, 0.42], [0, -30]);
  const glow = useTransform(smooth, [0, 0.42], [0.45, 0.85]);
  // Floating details drift at their own depth.
  const nearY = useTransform(smooth, [0, 0.6], [0, -120]);
  const farY = useTransform(smooth, [0, 0.6], [0, -60]);

  return (
    <section ref={section} className="relative isolate overflow-x-clip pt-36 pb-10 sm:pt-44">
      {/* Light behind the window, and a floor that recedes into it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px]">
        <div className="absolute top-[420px] left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(178,205,189,0.16),transparent)] blur-2xl" />
        <div className="absolute top-[640px] left-1/2 h-[620px] w-[2200px] -translate-x-1/2 [perspective:900px]">
          <div className="h-full w-full origin-top [transform:rotateX(72deg)] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_65%)]" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <motion.h1
          {...rise(0.05)}
          className="mx-auto max-w-5xl text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[68px] lg:text-[84px]"
        >
          <span className="headline-gradient lg:whitespace-nowrap">Codex and Claude Code,</span>
          <br />
          <span className="muted-gradient">without the stops.</span>
        </motion.h1>
        <motion.p
          {...rise(0.18)}
          className="mx-auto mt-6 max-w-xl text-[17px] leading-7 text-muted sm:text-[18px]"
        >
          A desktop workspace for your coding agents. When an account reaches its usage limit, the
          task keeps going on the next one.
        </motion.p>
        <motion.div
          {...rise(0.3)}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <DownloadButton />
          <a
            href={REPO}
            className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-muted ring-1 ring-line-strong transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <GithubLogo size={16} />
            View on GitHub
          </a>
        </motion.div>
        <motion.div
          {...rise(0.4)}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] whitespace-nowrap text-faint"
        >
          <span>Free and open source</span>
          <span className="hidden h-3 w-px bg-line-strong sm:block" />
          <span className="flex items-center gap-2">
            Works with
            <img src="/brands/openai.svg" alt="" className="size-3.5 opacity-80" />
            Codex
            <img src="/brands/claude.svg" alt="" className="size-3.5" />
            Claude Code
          </span>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[1180px] px-4 sm:mt-20 sm:px-8 [perspective:2200px]">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.35, ease: EASE }}
          style={{ rotateX, scale, y: lift, transformOrigin: '50% 0%' }}
          className="relative [transform-style:preserve-3d]"
        >
          <motion.div
            aria-hidden
            style={{ opacity: glow }}
            className="absolute -inset-x-10 -bottom-16 top-1/3 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(178,205,189,0.22),transparent)] blur-3xl"
          />
          <div className="overflow-hidden rounded-[14px] bg-[#1f1f1f] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_1px_0_0_rgba(255,255,255,0.08)_inset,0_50px_140px_-40px_rgba(0,0,0,0.95)] sm:rounded-[18px]">
            <Video
              name="hero"
              label="Perpetual running a Codex task that reaches its usage limit and continues on the next account"
              className="block aspect-[16/10] w-full"
            />
          </div>

          <motion.div
            aria-hidden
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.3, ease: EASE }}
            style={{ y: nearY, translateZ: 90 }}
            className="absolute bottom-[18%] -left-6 hidden items-center gap-2.5 rounded-full bg-[#232423]/90 py-2.5 pr-4 pl-3 text-[13px] text-muted shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md lg:flex"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-warn)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.3 6.4L3 16M3 21v-5h5" />
            </svg>
            Account limit reached; continuing with{' '}
            <span className="text-ink">work@northwind.dev</span>
          </motion.div>

          <motion.div
            aria-hidden
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.5, ease: EASE }}
            style={{ y: farY, translateZ: 60 }}
            className="absolute top-[14%] -right-8 hidden w-64 rounded-2xl bg-[#232423]/90 p-2 text-left text-[13px] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_30px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md lg:block"
          >
            <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-1 text-[11px] text-faint">
              <img src="/brands/openai.svg" alt="" className="size-3" />
              Codex
            </div>
            <div className="rounded-lg px-2.5 py-1.5">
              <div className="text-ink/90">maya@northwind.dev</div>
              <div className="text-[11px] text-warn">Limited until 4:15 PM</div>
            </div>
            <div className="flex items-center rounded-lg bg-white/[0.05] px-2.5 py-1.5">
              <div>
                <div className="text-ink">work@northwind.dev</div>
                <div className="text-[11px] text-faint">Pro</div>
              </div>
              <svg
                className="ml-auto"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
