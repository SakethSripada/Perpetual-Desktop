const GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")';

// Each bloom is a radial gradient whose falloff does the blurring, so the
// browser paints it once and never has to blur anything.
const bloom = (color: string) =>
  `radial-gradient(closest-side, ${color} 0%, ${color} 38%, color-mix(in srgb, ${color} 55%, transparent) 62%, color-mix(in srgb, ${color} 18%, transparent) 82%, transparent 100%)`;

/** Soft, still lavender light behind the hero, under film grain. */
export function LiquidGradient({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden bg-black ${className}`}>
      <div
        className="absolute top-[-22%] left-[-22%] h-[84%] w-[84%] opacity-75"
        style={{ backgroundImage: bloom('#9C8EB8') }}
      />
      <div
        className="absolute right-[-20%] bottom-[-22%] h-[84%] w-[70%] opacity-75"
        style={{ backgroundImage: bloom('#D4CBE5') }}
      />
      <div
        className="absolute top-[40%] left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 opacity-60"
        style={{ backgroundImage: bloom('#E4DDF0') }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}
