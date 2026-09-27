import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { Video } from './Video';

/** Seconds into the recording where each part of the story ends. */
const TIMELINE = [2.2, 13.2, 17.2, 21.5];
const LIMIT_AT = 13.9;

const STEPS = [
  {
    title: 'Describe the task.',
    body: 'Pick Codex or Claude Code and a folder. Every read, edit, and command streams in as it happens.',
  },
  {
    title: 'Limits don’t stop it.',
    body: 'When an account runs out, the task moves to your next account and picks up exactly where it left off.',
  },
  {
    title: 'Come back to finished work.',
    body: 'Tests run, the result is summarized, and nothing touches your project until you review the diff.',
  },
];

/** Maps scroll progress (0..1) onto the recording, one step per third. */
function timeAt(p: number) {
  const n = STEPS.length;
  const i = Math.min(n - 1, Math.floor(p * n));
  const local = p * n - i;
  return TIMELINE[i] + (TIMELINE[i + 1] - TIMELINE[i]) * local;
}

export function Story() {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const target = useRef(TIMELINE[0]);
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.35 });
  const rotateY = useTransform(progress, [0, 1], [reduce ? 0 : -9, reduce ? 0 : -3]);
  const rotateX = useTransform(progress, [0, 1], [reduce ? 0 : 4, 0]);
  const bar = useTransform(progress, [0, 1], ['0%', '100%']);

  useMotionValueEvent(progress, 'change', (p) => {
    const clamped = Math.min(0.9999, Math.max(0, p));
    target.current = timeAt(clamped);
    setStep(Math.floor(clamped * STEPS.length));
  });

  // Seek toward the scroll position once per frame, never stacking seeks.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - target.current) > 0.02) {
        v.currentTime = target.current;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section id="how" ref={section} className="relative h-[340vh] scroll-mt-0">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1320px] items-center gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)] lg:gap-14">
          <div className="relative order-2 min-h-[150px] lg:order-1 lg:min-h-[260px]">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                className="absolute inset-x-0 top-0"
                initial={false}
                animate={
                  i === step
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : { opacity: 0, y: i < step ? -18 : 18, filter: 'blur(6px)' }
                }
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden={i !== step}
              >
                <h2 className="text-[30px] leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[38px]">
                  {s.title}
                </h2>
                <p className="mt-4 max-w-sm text-[16px] leading-7 text-muted sm:text-[17px]">{s.body}</p>
              </motion.div>
            ))}
            <div className="absolute bottom-0 left-0 hidden gap-1.5 lg:flex">
              {STEPS.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === step ? 'w-8 bg-ink' : 'w-3 bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="order-1 [perspective:1800px] lg:order-2">
            <motion.div style={{ rotateY, rotateX }} className="relative">
              <div
                aria-hidden
                className="absolute -inset-10 -z-10 rounded-[48px] bg-[radial-gradient(closest-side,rgba(178,205,189,0.12),transparent)] blur-2xl"
              />
              <div className="overflow-hidden rounded-[14px] bg-[#1f1f1f] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_40px_120px_-40px_rgba(0,0,0,0.95)]">
                <Video
                  ref={video}
                  name="hero"
                  variant="-scrub"
                  autoPlay={false}
                  loop={false}
                  label="A Codex task streaming its work, switching accounts at a usage limit, and finishing"
                  className="block aspect-[16/10] w-full"
                />
              </div>
              <Timeline progress={bar} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A slim scrubber under the window, with a mark where the limit hits. */
function Timeline({ progress }: { progress: MotionValue<string> }) {
  // Scroll is split evenly per step, so place the mark on the scroll scale.
  const limit = (1 + (LIMIT_AT - TIMELINE[1]) / (TIMELINE[2] - TIMELINE[1])) / STEPS.length;
  return (
    <div className="mx-auto mt-6 max-w-md px-1" aria-hidden>
      <div className="relative h-[3px] rounded-full bg-white/[0.08]">
        <motion.div style={{ width: progress }} className="absolute inset-y-0 left-0 rounded-full bg-sage/70" />
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn shadow-[0_0_0_3px_var(--color-bg)]"
          style={{ left: `${limit * 100}%` }}
        />
      </div>
    </div>
  );
}

