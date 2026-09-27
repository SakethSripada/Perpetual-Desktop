import { useEffect, useRef } from 'react';

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Slow, domain-warped noise tinted from indigo through blue and violet, lit from the
// top and fading to the page color well before the headline.
const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform float t;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(uv.x * res.x / res.y, uv.y) * 0.75;
  float s = t * 0.05;
  // Large, soft shapes only: low frequency and a gentle warp, no fine detail.
  vec2 q = vec2(fbm(p + vec2(0.0, s)), fbm(p + vec2(5.2, -s)));
  float n = fbm(p + 1.4 * q + vec2(s * 0.6, 0.0));

  // Deep indigo lifting into electric blue, with violet and a cyan edge.
  vec3 deep = vec3(0.07, 0.08, 0.32);
  vec3 blue = vec3(0.20, 0.40, 1.00);
  vec3 violet = vec3(0.52, 0.30, 0.98);
  vec3 cyan = vec3(0.30, 0.78, 1.00);
  vec3 col = mix(deep, blue, smoothstep(0.28, 0.72, n));
  col = mix(col, violet, smoothstep(0.45, 0.85, q.x) * 0.75);
  col = mix(col, cyan, smoothstep(0.6, 0.95, q.y) * 0.45);

  // A bright pool of light up and to the right that drifts and breathes,
  // over a fainter band across the whole top edge.
  vec2 c = vec2(0.68 + 0.12 * sin(s * 2.1), 1.08 + 0.04 * cos(s * 1.7));
  float d = length((uv - c) * vec2(res.x / res.y * 0.55, 1.5)) + 0.35 * (n - 0.5);
  float pool = 1.0 - smoothstep(0.08, 0.78, d);
  float band = smoothstep(0.6 + 0.12 * (n - 0.5), 1.05, uv.y) * 0.55;
  float glow = clamp(max(pool, band), 0.0, 1.0);
  vec3 bg = vec3(0.043, 0.047, 0.043);
  gl_FragColor = vec4(mix(bg, col, glow), 1.0);
}
`;

/**
 * A moving gradient behind the hero, drawn with a tiny WebGL shader at reduced
 * resolution. Pauses offscreen, holds still with reduced motion, and falls
 * back to a static gradient when WebGL isn't available.
 */
export function Aurora({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const gl = el?.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    if (!el || !gl) return;

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
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const res = gl.getUniformLocation(program, 'res');
    const time = gl.getUniformLocation(program, 't');

    // The picture is soft, so half resolution is indistinguishable and cheap.
    const resize = () => {
      const w = Math.max(1, Math.round(el.clientWidth * 0.5));
      const h = Math.max(1, Math.round(el.clientHeight * 0.5));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(res, w, h);
    };

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const offset = 40 + Math.random() * 60;
    let visible = true;
    let raf = 0;
    const draw = (now: number) => {
      resize();
      gl.uniform1f(time, offset + (still ? 0 : now / 1000));
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
    return () => {
      seen.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`bg-[radial-gradient(ellipse_80%_60%_at_60%_0%,rgba(70,90,230,0.35),transparent_70%)] ${className}`}
    >
      <canvas
        ref={canvas}
        className="h-full w-full opacity-0 transition-opacity duration-[1500ms] data-[ready]:opacity-100"
      />
    </div>
  );
}
