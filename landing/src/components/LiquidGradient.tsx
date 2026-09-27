import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

const GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")';

/**
 * Soft lavender light behind the hero: two slow drifting blooms and a third
 * that trails the cursor, melted together by a heavy blur and film grain.
 */
export function LiquidGradient({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 40, damping: 20, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 40, damping: 20, mass: 0.8 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.jump(r.width / 2);
    y.jump(r.height / 2.4);
    sx.jump(r.width / 2);
    sy.jump(r.height / 2.4);
    // Content sits on top of the light, so follow the pointer at the window.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const b = el.getBoundingClientRect();
      if (e.clientY > b.bottom) return;
      x.set(e.clientX - b.left);
      y.set(e.clientY - b.top);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [x, y, sx, sy]);

  return (
    <div ref={box} aria-hidden className={`overflow-hidden bg-black ${className}`}>
      <div className="absolute inset-0">
        <motion.div
          animate={
            reduce
              ? undefined
              : { x: [0, 50, 0, -50, 0], y: [0, -50, 50, -20, 0], scale: [1, 1.2, 0.9, 1.1, 1] }
          }
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full bg-[#9C8EB8] opacity-80 mix-blend-screen"
        />
        <motion.div
          animate={
            reduce
              ? undefined
              : { x: [0, -60, 20, 40, 0], y: [0, 40, -40, 30, 0], scale: [1, 0.8, 1.3, 0.9, 1] }
          }
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute right-[-10%] bottom-[-10%] h-[60%] w-[50%] rounded-full bg-[#D4CBE5] opacity-80 mix-blend-screen"
        />
        <motion.div
          style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
          className="absolute top-0 left-0 size-[400px] rounded-full bg-[#E4DDF0] opacity-70 mix-blend-screen"
        />
      </div>
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[80px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}
