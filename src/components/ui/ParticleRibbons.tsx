import { useEffect, useRef } from 'react';

/**
 * ParticleRibbons — flowing light-trail ribbons behind the hero.
 *
 * Recreates the signature motion from the reference video: dozens of thin
 * glowing strands sweeping in large S-curves and arcs, emanating from a
 * bright glow-burst point, morphing continuously like slow liquid, with
 * additive bloom and faint drifting sparkle dust.
 *
 * - Dark mode: vivid lime/emerald/teal trails with additive blending + bloom.
 * - Light mode: the same geometry rendered as soft emerald strokes at low
 *   opacity (normal blending, no bloom wash-out).
 * - Respects prefers-reduced-motion (renders one frozen frame).
 * - Pauses when scrolled out of view; DPR-capped for performance.
 */
export default function ParticleRibbons({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDark = () => document.documentElement.classList.contains('dark');

    type Ribbon = {
      kind: 'arc' | 'stream';
      angle: number;      // arc: direction from burst point (radians)
      reach: number;      // arc: length factor
      yBase: number;      // stream: vertical base (0..1)
      hue: number; sat: number; light: number;
      speed: number; phase: number;
      amp: number; freq: number;
      width: number; alpha: number;
      bend: number;       // arc curvature drift
    };
    type Spark = { x: number; y: number; vx: number; vy: number; r: number; ph: number; sp: number };

    let ribbons: Ribbon[] = [];
    let sparks: Spark[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    // Brand-adjacent palette: lime hero, emerald, teal accents, rare warm gold
    const pickHue = () => {
      const r = Math.random();
      if (r < 0.5) return { h: rand(68, 88), s: 95, l: 62 };   // lime
      if (r < 0.78) return { h: rand(150, 168), s: 80, l: 58 }; // emerald
      if (r < 0.93) return { h: rand(172, 188), s: 85, l: 60 }; // teal
      return { h: rand(40, 52), s: 95, l: 62 };                 // gold accent
    };

    const build = () => {
      const count = w < 640 ? 9 : 17;
      ribbons = [];
      for (let i = 0; i < count; i++) {
        const c = pickHue();
        const isArc = Math.random() < 0.62;
        ribbons.push({
          kind: isArc ? 'arc' : 'stream',
          angle: rand(-0.5, 1.25),           // up-right fan
          reach: rand(0.55, 1.15),
          yBase: rand(0.08, 0.92),
          hue: c.h, sat: c.s, light: c.l,
          speed: rand(0.25, 0.7),
          phase: rand(0, Math.PI * 2),
          amp: rand(14, 46),
          freq: rand(1.6, 3.4),
          width: rand(0.8, 1.9),
          alpha: rand(0.35, 0.8),
          bend: rand(-1, 1),
        });
      }
      sparks = [];
      const sparkCount = w < 640 ? 22 : 44;
      for (let i = 0; i < sparkCount; i++) {
        sparks.push({
          x: rand(0, w), y: rand(0, h),
          vx: rand(-6, 14), vy: rand(-10, 6),
          r: rand(0.6, 1.8), ph: rand(0, Math.PI * 2), sp: rand(0.6, 2),
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    // Burst point (the glowing emanation knot), in hero-local coords
    const burstX = () => w * 0.46;
    const burstY = () => h * 0.3;

    const SEG = 56;

    const ribbonPoint = (r: Ribbon, t: number, k: number): [number, number] => {
      const tt = t * r.speed + r.phase;
      if (r.kind === 'arc') {
        // Quadratic bezier from burst point, control point drifts with time
        // (this is the slow-liquid morph of the S-curves).
        const ang = r.angle + Math.sin(tt * 0.6) * 0.28;
        const len = Math.min(w, h) * 1.5 * r.reach;
        const ex = burstX() + Math.cos(ang) * len;
        const ey = burstY() + Math.sin(ang) * len;
        const bendAmt = r.bend * len * 0.35;
        const cx = (burstX() + ex) / 2 + Math.cos(ang + Math.PI / 2) * bendAmt + Math.sin(tt * 0.8) * 40;
        const cy = (burstY() + ey) / 2 + Math.sin(ang + Math.PI / 2) * bendAmt + Math.cos(tt * 0.7) * 40;
        const x0 = burstX(), y0 = burstY();
        const mt = k * k * (3 - 2 * k); // smoothstep: head lingers near burst
        const x = (1 - mt) * (1 - mt) * x0 + 2 * (1 - mt) * mt * cx + mt * mt * ex;
        const y = (1 - mt) * (1 - mt) * y0 + 2 * (1 - mt) * mt * cy + mt * mt * ey;
        // Ripple perpendicular to the curve for the light-trail shimmer
        const px = -(ey - y0), py = ex - x0;
        const pl = Math.hypot(px, py) || 1;
        const wave = Math.sin(k * Math.PI * r.freq + tt * 2.2) * r.amp * Math.sin(k * Math.PI);
        return [x + (px / pl) * wave, y + (py / pl) * wave];
      }
      // stream: long horizontal data-stream across the section
      const x = k * (w + 160) - 80;
      const y = r.yBase * h + Math.sin(k * Math.PI * r.freq + tt * 1.8) * r.amp
        + Math.sin(k * Math.PI * 2.3 + tt) * r.amp * 0.35;
      return [x, y];
    };

    const draw = (time: number) => {
      const t = time / 1000;
      const dark = isDark();
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. Glow-burst emanation point
      const bx = burstX(), by = burstY();
      const pulse = 1 + Math.sin(t * 1.4) * 0.12;
      const burstR = Math.min(w, h) * 0.16 * pulse;
      const burstAlpha = dark ? 0.5 : 0.14;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, burstR);
      g.addColorStop(0, `hsla(80, 95%, 68%, ${burstAlpha})`);
      g.addColorStop(0.4, `hsla(90, 90%, 60%, ${burstAlpha * 0.5})`);
      g.addColorStop(1, 'hsla(90, 90%, 60%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - burstR, by - burstR, burstR * 2, burstR * 2);
      // hot core
      const core = ctx.createRadialGradient(bx, by, 0, bx, by, burstR * 0.28);
      core.addColorStop(0, `hsla(75, 100%, 80%, ${dark ? 0.9 : 0.35})`);
      core.addColorStop(1, 'hsla(75, 100%, 80%, 0)');
      ctx.fillStyle = core;
      ctx.fillRect(bx - burstR * 0.3, by - burstR * 0.3, burstR * 0.6, burstR * 0.6);

      // 2. Ribbons — glow pass then bright core, head-to-tail fade
      for (const r of ribbons) {
        const passes: Array<{ mult: number; aMult: number }> = dark
          ? [{ mult: 4.2, aMult: 0.14 }, { mult: 1, aMult: 1 }]
          : [{ mult: 2.6, aMult: 0.16 }];
        for (const p of passes) {
          for (let s = 1; s <= SEG; s++) {
            const k0 = (s - 1) / SEG, k1 = s / SEG;
            const [x0, y0] = ribbonPoint(r, t, k0);
            const [x1, y1] = ribbonPoint(r, t, k1);
            // head (k=0, at burst) brightest, fading along the trail
            const fade = Math.pow(1 - k1, 1.6);
            const a = r.alpha * fade * p.aMult * (dark ? 1 : 0.5);
            if (a < 0.004) continue;
            ctx.strokeStyle = `hsla(${r.hue}, ${r.sat}%, ${dark ? r.light : Math.max(30, r.light - 18)}%, ${a})`;
            ctx.lineWidth = Math.max(0.4, r.width * p.mult * (0.5 + fade * 0.7));
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        }
        // bright head dot
        const [hx, hy] = ribbonPoint(r, t, 0.02);
        ctx.fillStyle = `hsla(${r.hue}, 100%, ${dark ? 82 : 55}%, ${r.alpha * (dark ? 0.9 : 0.45)})`;
        ctx.beginPath();
        ctx.arc(hx, hy, r.width * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Sparkle dust drifting through
      for (const s of sparks) {
        s.x += s.vx * 0.016; s.y += s.vy * 0.016;
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `hsla(80, 90%, ${dark ? 72 : 45}%, ${tw * (dark ? 0.5 : 0.28)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    if (reducedMotion) {
      draw(900); // one frozen, well-posed frame
      return () => { ro.disconnect(); io.disconnect(); };
    }

    const loop = (time: number) => {
      if (running) draw(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
