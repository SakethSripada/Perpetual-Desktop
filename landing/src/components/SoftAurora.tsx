import { useEffect, useRef, useState } from 'react';

const VERTEX = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Soft Aurora, from RewampUI: slow sweeping bands of lilac on a dark ground.
const FRAGMENT = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;

  void main() {
    vec2 p = gl_FragCoord.xy / u_resolution.xy;
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.15;

    float wave1 = sin(p.x * 2.0 + t) * 0.5 + 0.5;
    float wave2 = sin(p.y * 3.0 - t * 1.5 + wave1) * 0.5 + 0.5;
    float wave3 = sin((p.x + p.y) * 2.0 + t + wave2 * 2.0) * 0.5 + 0.5;

    vec3 bg = vec3(0.01, 0.02, 0.04);
    vec3 auroraMain = vec3(0.894, 0.867, 0.941);
    vec3 auroraSec = vec3(0.831, 0.796, 0.898);
    vec3 auroraAccent = vec3(0.612, 0.557, 0.722);

    vec3 currentLayer = mix(auroraMain, auroraSec, wave1);
    currentLayer = mix(currentLayer, auroraAccent, wave2);

    float mask = smoothstep(0.4, 0.6, wave3);
    mask *= sin(p.y * 3.14) * 1.2;
    mask = clamp(mask, 0.0, 1.0);

    vec3 finalColor = mix(bg, currentLayer, mask * 0.4);
    finalColor += auroraMain * smoothstep(0.7, 1.0, wave2) * 0.2;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/**
 * A slowly moving aurora behind the hero. It never follows the cursor. To
 * stay light it renders at half size (the bands are soft, so it looks the
 * same), pauses off screen, and holds still with reduced motion.
 *
 * Each mount draws into its own canvas and hands the GPU context back when
 * it unmounts, so hot reloads and remounts never pile up contexts until the
 * browser starts dropping them. If the browser does reclaim it, it rebuilds.
 */
export function SoftAurora({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    const el = document.createElement('canvas');
    el.className =
      'absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000 data-[ready]:opacity-100';
    host.appendChild(el);
    const gl = el.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'low-power',
    });
    if (!gl) return () => el.remove();

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, 'u_time');
    const res = gl.getUniformLocation(program, 'u_resolution');

    const resize = () => {
      const w = Math.max(1, Math.round(el.clientWidth / 2));
      const h = Math.max(1, Math.round(el.clientHeight / 2));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(res, w, h);
    };
    const sized = new ResizeObserver(resize);
    sized.observe(el);
    resize();

    // Start where the bands are already lit rather than in a dark lull.
    const OFFSET = 6;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const begin = performance.now();
    let visible = true;
    let raf = 0;
    const draw = (now: number) => {
      gl.uniform1f(time, OFFSET + (still ? 6 : (now - begin) / 1000));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      el.dataset.ready = '';
      if (!still && visible) raf = requestAnimationFrame(draw);
    };
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    seen.observe(el);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const restored = () => setGeneration((g) => g + 1);
    el.addEventListener('webglcontextlost', lost);
    el.addEventListener('webglcontextrestored', restored);

    return () => {
      seen.disconnect();
      sized.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener('webglcontextlost', lost);
      el.removeEventListener('webglcontextrestored', restored);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      el.remove();
    };
  }, [generation]);

  return (
    <div
      ref={box}
      aria-hidden
      className={`bg-[#030509] bg-[radial-gradient(ellipse_70%_55%_at_65%_35%,rgba(156,142,184,0.22),transparent_70%)] ${className}`}
    />
  );
}
