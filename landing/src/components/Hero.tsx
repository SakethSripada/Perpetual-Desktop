import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { REPO } from '../lib/site';
import { LiquidGradient } from './LiquidGradient';
import { DownloadButton } from './DownloadButton';
import { GithubLogo } from './Mark';
import { Video } from './Video';

const EASE = [0.16, 1, 0.3, 1] as const;

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
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
  // The floating switcher drifts at its own depth.
  const farY = useTransform(smooth, [0, 0.6], [0, -60]);

  return (
    <section ref={section} className="relative isolate overflow-x-clip pt-36 pb-10 sm:pt-44">
      {/* Light behind the window, and a floor that recedes into it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px]">
        <LiquidGradient className="absolute inset-x-0 top-0 h-[900px]" />
        {/* Fade into the page with a plain overlay rather than a mask, which
            would make the browser redraw the whole moving surface. */}
        <div className="absolute inset-x-0 top-[480px] h-[421px] bg-gradient-to-b from-transparent to-bg" />
        <div className="absolute top-[420px] left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(110,120,255,0.12),transparent)]" />
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
          <span className="text-white/60">without the stops.</span>
        </motion.h1>
        <motion.p
          {...rise(0.18)}
          className="mx-auto mt-6 max-w-xl text-[17px] leading-7 text-white/75 sm:text-[18px]"
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
            className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-white/85 ring-1 ring-white/25 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <GithubLogo size={16} />
            View on GitHub
          </a>
        </motion.div>
        <motion.div
          {...rise(0.4)}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] whitespace-nowrap text-white/55"
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
            className="absolute -inset-x-10 -bottom-16 top-1/3 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(110,120,255,0.2),transparent)]"
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.5, ease: EASE }}
            style={{ y: farY, translateZ: 60 }}
            className="absolute top-[14%] -right-8 hidden w-64 rounded-2xl bg-[#232423]/95 p-2 text-left text-[13px] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_30px_70px_-24px_rgba(0,0,0,0.95)] lg:block"
          >
            <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-1 text-[11px] text-faint">
              <img src="/brands/openai.svg" alt="" className="size-3" />
              Codex
            </div>
            <div className="rounded-lg px-2.5 py-1.5">
              <div className="text-ink/90">Codex sign-in</div>
              <div className="text-[11px] text-warn">Limited until 4:15 PM</div>
            </div>
            <div className="flex items-center rounded-lg bg-white/[0.05] px-2.5 py-1.5">
              <div>
                <div className="text-ink">Work</div>
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
