import { useEffect, useRef } from 'react';

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Folds of glossy silk: a smooth height field lit by a soft key light, so
// the crests catch a sheen. The cursor presses into the surface and drags
// the folds after it.
const FRAGMENT = `
precision highp float;
uniform vec2 res;
uniform float t;
uniform vec2 mouse;   // smoothed pointer, in uv
uniform vec2 drag;    // pointer velocity, eased
uniform float press;  // 0..1, how strongly the pointer is felt

float field(vec2 p) {
  vec2 q = p;
  q += 0.32 * vec2(sin(q.y * 1.3 + t * 0.21), cos(q.x * 1.1 - t * 0.17));
  q += 0.18 * vec2(sin(q.y * 2.3 - t * 0.13), cos(q.x * 2.0 + t * 0.19));

  // The pointer: a soft dent that trails its own motion.
  vec2 aspect = vec2(res.x / res.y, 1.0);
  vec2 d = (p / 2.2 - mouse) * aspect;
  float near = exp(-dot(d, d) * 7.0) * press;
  q += (d * 0.6 - drag * 2.2) * near;

  float fold = sin(q.x * 2.1 + q.y * 1.35 + 1.4 * sin(q.y * 0.8 + t * 0.12));
  fold += 0.45 * sin(q.x * 3.7 - q.y * 0.9 + t * 0.09);
  return fold * 0.5 - near * 0.8;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = uv * 2.2;

  float e = 1.5 / res.y;
  float h = field(p);
  vec3 n = normalize(vec3(field(p - vec2(e, 0.0)) - field(p + vec2(e, 0.0)),
                          field(p - vec2(0.0, e)) - field(p + vec2(0.0, e)),
                          e * 2.4));
  vec3 light = normalize(vec3(-0.45, 0.6, 0.66));
  float diffuse = clamp(dot(n, light), 0.0, 1.0);
  float sheen = pow(clamp(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 14.0);

  vec3 deep = vec3(0.05, 0.05, 0.13);
  vec3 indigo = vec3(0.22, 0.2, 0.62);
  vec3 violet = vec3(0.5, 0.36, 0.92);
  vec3 col = mix(deep, indigo, smoothstep(-0.9, 0.7, h));
  col = mix(col, violet, smoothstep(0.35, 1.0, h) * 0.55);
  // Keep the middle calm behind the headline, richer toward the edges.
  vec2 c = (uv - vec2(0.5, 0.6)) * vec2(1.2, 1.7);
  float calm = smoothstep(0.05, 0.8, length(c));
  col *= (0.35 + 0.9 * diffuse) * (0.62 + 0.38 * calm);
  col += vec3(0.85, 0.82, 1.0) * sheen * mix(0.22, 0.85, calm);
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * A liquid silk gradient behind the hero that bends toward the cursor. Drawn
 * with a small WebGL shader at reduced resolution; it pauses offscreen, holds
 * still with reduced motion, and drifts on its own on touch screens.
 */
export function LiquidGradient({ className = '' }: { className?: string }) {
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
    const u = (name: string) => gl.getUniformLocation(program, name);
    const res = u('res');
    const time = u('t');
    const mouse = u('mouse');
    const drag = u('drag');
    const press = u('press');

    // The surface is soft, so rendering below full resolution looks the same.
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    const resize = () => {
      const w = Math.max(1, Math.round(el.clientWidth * scale));
      const h = Math.max(1, Math.round(el.clientHeight * scale));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(res, w, h);
    };

    // Where the pointer is, and where the liquid thinks it is: the latter
    // chases the former, which is what makes it feel heavy and wet.
    const target = { x: 0.62, y: 0.7 };
    const pos = { ...target };
    const vel = { x: 0, y: 0 };
    let felt = 0;
    let lastMove = -1e9;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      if (e.clientY > r.bottom) return;
      target.x = (e.clientX - r.left) / r.width;
      target.y = 1 - (e.clientY - r.top) / r.height;
      lastMove = performance.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const offset = 20 + Math.random() * 40;
    let visible = true;
    let raf = 0;
    let prev = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const idle = now - lastMove > 2500;
      if (idle) {
        // No mouse (or it's resting): wander slowly so the surface still lives.
        const s = (offset + now / 1000) * 0.12;
        target.x = 0.5 + 0.32 * Math.sin(s * 1.3);
        target.y = 0.62 + 0.18 * Math.sin(s * 0.9 + 1.2);
      }
      const k = 1 - Math.exp(-dt * (idle ? 1.2 : 3.2));
      const nx = pos.x + (target.x - pos.x) * k;
      const ny = pos.y + (target.y - pos.y) * k;
      const kv = 1 - Math.exp(-dt * 5);
      vel.x += (nx - pos.x - vel.x) * kv;
      vel.y += (ny - pos.y - vel.y) * kv;
      pos.x = nx;
      pos.y = ny;
      felt += ((idle ? 0.55 : 1) - felt) * (1 - Math.exp(-dt * 2));

      resize();
      gl.uniform1f(time, offset + (still ? 0 : now / 1000));
      gl.uniform2f(mouse, pos.x, pos.y);
      gl.uniform2f(drag, vel.x, vel.y);
      gl.uniform1f(press, felt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      el.dataset.ready = '';
      if (!still && visible) raf = requestAnimationFrame(draw);
    };
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        prev = performance.now();
        raf = requestAnimationFrame(draw);
      }
    });
    seen.observe(el);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(80,70,200,0.35),transparent_70%)] ${className}`}
    >
      <canvas
        ref={canvas}
        className="h-full w-full opacity-0 transition-opacity duration-[1500ms] data-[ready]:opacity-100"
      />
    </div>
  );
}
