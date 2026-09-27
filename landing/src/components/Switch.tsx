import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Reveal } from './Reveal';
import { Video } from './Video';

/** Where the recording switches the task over to Claude Code. */
const SWITCHED_AT = 3.9;

const AGENTS = [
  { id: 'codex', name: 'Codex', logo: '/brands/openai.svg', glow: 'rgba(178,205,189,0.2)' },
  { id: 'claude', name: 'Claude Code', logo: '/brands/claude.svg', glow: 'rgba(217,119,87,0.2)' },
] as const;

export function Switch() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [agent, setAgent] = useState<'codex' | 'claude'>('codex');
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);

  // Follow the recording so the toggle flips when the app does.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = () => setAgent(v.currentTime >= SWITCHED_AT ? 'claude' : 'codex');
    v.addEventListener('timeupdate', sync);
    return () => v.removeEventListener('timeupdate', sync);
  }, []);

  const active = AGENTS.find((a) => a.id === agent)!;

  return (
    <section className="relative px-5 pt-16 pb-28 sm:px-8 sm:pt-24 sm:pb-36">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] text-balance sm:text-[52px]">
          <span className="headline-gradient">Codex or Claude Code.</span>
          <br />
          <span className="muted-gradient">Same thread.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-7 text-balance text-muted">
          Switch agents or models mid-task without losing the conversation. New models appear as soon as your CLI has
          them.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10 flex justify-center">
        <div className="relative flex rounded-full bg-white/[0.04] p-1 ring-1 ring-line" role="presentation">
          {AGENTS.map((a) => (
            <div
              key={a.id}
              className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-colors duration-500 ${
                a.id === agent ? 'text-ink' : 'text-faint'
              }`}
            >
              {a.id === agent && (
                <motion.span
                  layoutId="agent-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-white/[0.09] ring-1 ring-white/10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <img src={a.logo} alt="" className={`size-4 transition-opacity ${a.id === agent ? '' : 'opacity-50'}`} />
              {a.name}
            </div>
          ))}
        </div>
      </Reveal>

      <div ref={frame} className="mx-auto mt-10 max-w-[1120px] [perspective:2000px]">
        <motion.div style={{ rotateX, scale, transformOrigin: '50% 100%' }} className="relative">
          <motion.div
            aria-hidden
            animate={{ backgroundColor: active.glow }}
            transition={{ duration: 1.2 }}
            className="absolute inset-x-[8%] -bottom-10 top-[20%] -z-10 rounded-full blur-[90px]"
          />
          <div className="overflow-hidden rounded-[14px] bg-[#1f1f1f] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_50px_120px_-40px_rgba(0,0,0,0.95)] sm:rounded-[18px]">
            <Video
              ref={video}
              name="claude"
              label="Switching a finished Codex task over to Claude Code with Opus 5.5 and sending a follow-up"
              className="block aspect-[16/10] w-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
