/* WebGLBackground — flagship animated backdrop. Raw WebGL1, zero
 * dependencies: a monochrome dot-grid that ripples around the cursor,
 * faint drifting contour bands, and film grain — all in the site palette
 * (near-white paper / black ink, chosen per section via `variant`).
 *
 * Performance + access contract:
 * - DPR capped at 1.5, single fullscreen triangle, ~20 lines of GLSL
 * - Pauses when offscreen (IntersectionObserver) or tab hidden
 * - prefers-reduced-motion renders ONE static frame, no loop
 * - If WebGL is unavailable the section's CSS background shows instead
 */
"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_bg;
uniform vec3 u_dot;
uniform vec3 u_line;
uniform float u_density;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // --- dot grid with cursor ripple + ambient drift
  vec2 g = p * u_density;
  vec2 cell = fract(g) - 0.5;
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  float md = distance(p, m);
  float ripple = sin(u_time * 1.1 - md * 9.0) * 0.5 + 0.5;
  float near = smoothstep(0.55, 0.0, md);
  float drift = sin(u_time * 0.6 + g.x * 0.35 + g.y * 0.28) * 0.5 + 0.5;
  float r = 0.085 + 0.17 * near * ripple + 0.028 * drift;
  float dot = smoothstep(r, r - 0.055, length(cell));

  // --- faint drifting contour bands
  float bands = sin((p.x * 0.8 + p.y * 1.4) * 7.0 + u_time * 0.22);
  float line = smoothstep(0.972, 1.0, bands);

  // --- grain
  float grain = hash(frag * 0.5 + fract(u_time) * 371.0) - 0.5;

  vec3 col = u_bg;
  col = mix(col, u_dot, dot * 0.5);
  col = mix(col, u_line, line * 0.30);
  col += grain * 0.045;
  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [v(0), v(2), v(4)];
}

const VARIANTS = {
  paper: { bg: "#FAFAFA", dot: "#0A0A0A", line: "#0A0A0A", density: 52 },
  ink: { bg: "#0A0A0A", dot: "#FAFAFA", line: "#FAFAFA", density: 44 },
} as const;

export function WebGLBackground({
  variant = "paper",
  fade = true,
  /** When true, swap to the dark-side palette when the site is in dark mode. */
  themed = false,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  fade?: boolean;
  themed?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const dark = themed && resolvedTheme === "dark";
  // Themed paper in dark mode behaves like ink, and vice versa.
  const active = themed && dark ? (variant === "paper" ? "ink" : "paper") : variant;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // CSS fallback underneath stays visible
    const v = VARIANTS[active];

    function shader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      bg: gl.getUniformLocation(prog, "u_bg"),
      dot: gl.getUniformLocation(prog, "u_dot"),
      line: gl.getUniformLocation(prog, "u_line"),
      density: gl.getUniformLocation(prog, "u_density"),
    };
    const [br, bg, bb] = hexToRgb(v.bg);
    const [dr, dg, db] = hexToRgb(v.dot);
    const [lr, lg, lb] = hexToRgb(v.line);
    gl.uniform3f(u.bg, br, bg, bb);
    gl.uniform3f(u.dot, dr, dg, db);
    gl.uniform3f(u.line, lr, lg, lb);
    gl.uniform1f(u.density, v.density);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mouse = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55 };
    function onMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
    }
    window.addEventListener("mousemove", onMove, { passive: true });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas!.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas!.clientHeight * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible && !reduced) loop();
        else cancelAnimationFrame(raf);
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    function draw(t: number) {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl!.uniform2f(u.res, canvas!.width, canvas!.height);
      gl!.uniform1f(u.time, t / 1000);
      gl!.uniform2f(u.mouse, mouse.x, mouse.y);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    function loop(now?: number) {
      if (!visible || document.hidden) return;
      draw(now ?? performance.now());
      raf = requestAnimationFrame(loop);
    }
    function onVis() {
      if (!document.hidden && visible && !reduced) loop();
      else cancelAnimationFrame(raf);
    }
    document.addEventListener("visibilitychange", onVis);

    if (reduced) {
      draw(1400); // one static frame
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      // NOTE: never force-lose the context here — this cleanup also runs
      // on theme toggle (re-init on the SAME canvas), and a lost context
      // without restore would permanently blank the canvas. Just drop GL
      // objects; the context itself is reused.
      try {
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      } catch {
        /* context already gone */
      }
    };
  }, [variant, active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={["pointer-events-none absolute inset-0 h-full w-full", className]
        .filter(Boolean)
        .join(" ")}
      style={
        fade
          ? {
              maskImage:
                "radial-gradient(130% 100% at 50% 0%, black 35%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(130% 100% at 50% 0%, black 35%, transparent 100%)",
            }
          : undefined
      }
    />
  );
}
