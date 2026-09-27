import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';

/**
 * A card that leans toward the pointer and catches a soft light where it is.
 * Flat on touch screens and with reduced motion.
 */
export function TiltCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 180, damping: 22 });
  const ry = useSpring(0, { stiffness: 180, damping: 22 });
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const light = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${x}% ${y}%, rgba(255,255,255,0.055), transparent 60%)`;

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse' || !card.current) return;
    const r = card.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    rx.set((0.5 - py) * 5);
    ry.set((px - 0.5) * 5);
    x.set(px * 100);
    y.set(py * 100);
    light.set(1);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
    light.set(0);
  };

  return (
    <div className={`[perspective:1400px] ${className}`}>
      <motion.div
        ref={card}
        onPointerMove={move}
        onPointerLeave={leave}
        style={{ rotateX: rx, rotateY: ry }}
        className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-card shadow-[0_0_0_1px_var(--color-line),0_1px_0_0_rgba(255,255,255,0.05)_inset] [transform-style:preserve-3d]"
      >
        <motion.div
          aria-hidden
          style={{ background: spotlight, opacity: light }}
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-500"
        />
        {children}
      </motion.div>
    </div>
  );
}
