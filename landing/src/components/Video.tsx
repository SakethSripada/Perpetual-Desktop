import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * A product recording that only downloads once it's near the screen and only
 * plays while visible. Recorded at 2x so text stays sharp on retina displays.
 */
export const Video = forwardRef<
  HTMLVideoElement,
  {
    name: string;
    /** Play on its own while visible (otherwise the parent controls time). */
    autoPlay?: boolean;
    loop?: boolean;
    /** Source file suffix, e.g. "-scrub" for the scroll-scrubbed variant. */
    variant?: string;
    /** Seconds to skip at the start, on first play and on every loop. */
    start?: number;
    className?: string;
    label: string;
  }
>(function Video({ name, autoPlay = true, loop = true, variant = '', start = 0, className, label }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useImperativeHandle(ref, () => video.current!);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const load = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), {
      rootMargin: '600px 0px',
    });
    const play = new IntersectionObserver(
      ([e]) => {
        if (!autoPlay) return;
        if (e.isIntersecting) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.35 },
    );
    // Native looping always restarts at zero, so loop by hand past `start`.
    const skip = () => {
      if (start && el.currentTime < start) el.currentTime = start;
    };
    const restart = () => {
      if (!start || !loop) return;
      el.currentTime = start;
      void el.play().catch(() => undefined);
    };
    el.addEventListener('loadedmetadata', skip);
    el.addEventListener('ended', restart);
    load.observe(el);
    play.observe(el);
    return () => {
      load.disconnect();
      play.disconnect();
      el.removeEventListener('loadedmetadata', skip);
      el.removeEventListener('ended', restart);
    };
  }, [autoPlay, loop, start]);

  return (
    <video
      ref={video}
      aria-label={label}
      className={className}
      poster={`/media/${name}.jpg`}
      muted
      playsInline
      loop={loop && !start}
      preload={near ? 'auto' : 'none'}
    >
      {near && variant === '' && <source src={`/media/${name}.webm`} type="video/webm" />}
      {near && <source src={`/media/${name}${variant}.mp4`} type="video/mp4" />}
    </video>
  );
});
