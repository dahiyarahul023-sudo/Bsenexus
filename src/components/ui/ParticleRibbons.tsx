import { useEffect, useRef } from 'react';

/**
 * ParticleRibbons — full-page ambient animation behind the landing page.
 *
 * A fixed canvas spanning the whole viewport (behind all landing content):
 *  - dozens of glowing light ribbons sweeping in S-curves/arcs from a slowly
 *    drifting glow-burst point, morphing like liquid
 *  - a plexus node field: nodes connect to each other AND to nearby ribbon
 *    heads with faint light threads ("apas me connected")
 *  - a cursor spotlight: a soft glow that follows the pointer, so the
 *    animation feels attached to buttons/interactions
 *  - drifting sparkle dust
 *
 * Dark mode: vivid lime/emerald/teal with additive bloom. Light mode: the
 * same motion rendered as soft emerald strokes at low opacity.
 * Respects prefers-reduced-motion, pauses when the tab is hidden, DPR-capped.
 */
export default function ParticleRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDark = () => document.documentElement.classList.contains('dark');
    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };

    type Ribbon = {
      arc: boolean; angle: number; reach: number; yBase: number;
      hue: number; sat: number; light: number;
      speed: number; phase: number; amp: number; freq: number;
      width: number; alpha: number; bend: number;
    };
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    type Spark = { x: number; y: number; vx: number; vy: number; r: number; ph: number; sp: number };

    let ribbons: Ribbon[] = [];
    let nodes: Node[] = [];
    let sparks: Spark[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pickHue = () => {
      const r = Math.random();
      if (r < 0.5) return { h: rand(68, 88), s: 95, l: 62 };
      if (r < 0.78) return { h: rand(150, 168), s: 80, l: 58 };
      if (r < 0.93) return { h: rand(172, 188), s: 85, l: 60 };
      return { h: rand(40, 52), s: 95, l: 62 };
    };

    const build = () => {
      const count = w < 640 ? 10 : 20;
      ribbons = [];
      for (let i = 0; i < count; i++) {
        const c = pickHue();
        ribbons.push({
          arc: Math.random() < 0.6,
          angle: rand(-0.6, 1.4), reach: rand(0.5, 1.2),
          yBase: rand(0.05, 0.95),
          hue: c.h, sat: c.s, light: c.l,
          speed: rand(0.22, 0.65), phase: rand(0, Math.PI * 2),
          amp: rand(12, 42), freq: rand(1.6, 3.4),
          width: rand(0.8, 1.8), alpha: rand(0.3, 0.75),
          bend: rand(-1, 1),
        });
      }
      nodes = [];
      const nn = w < 640 ? 20 : 34;
      for (let i = 0; i < nn; i++) {
        nodes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-14, 14), vy: rand(-12, 12), r: rand(1, 2.2) });
      }
      sparks = [];
      const sn = w < 640 ? 24 : 48;
      for (let i = 0; i < sn; i++) {
        sparks.push({ x: rand(0, w), y: rand(0, h), vx: rand(-6, 14), vy: rand(-10, 6), r: rand(0.6, 1.8), ph: rand(0, Math.PI * 2), sp: rand(0.6, 2) });
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      w = Math.max(1, window.innerWidth);
      h = Math.max(1, window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener('mousemove', onMouse, { passive: true });

    const onVis = () => { /* loop checks document.hidden */ };
    document.addEventListener('visibilitychange', onVis);

    // Glow-burst point drifts slowly across the viewport (lissajous)
    const burst = (t: number): [number, number] => [
      w * (0.5 + 0.32 * Math.sin(t * 0.11)),
      h * (0.42 + 0.3 * Math.sin(t * 0.073 + 1.3)),
    ];

    const SEG = 48;

    const ribbonPoint = (r: Ribbon, t: number, k: number, bx: number, by: number): [number, number] => {
      const tt = t * r.speed + r.phase;
      if (r.arc) {
        const ang = r.angle + Math.sin(tt * 0.6) * 0.28;
        const len = Math.max(w, h) * 0.9 * r.reach;
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        const bendAmt = r.bend * len * 0.35;
        const cx = (bx + ex) / 2 + Math.cos(ang + Math.PI / 2) * bendAmt + Math.sin(tt * 0.8) * 46;
        const cy = (by + ey) / 2 + Math.sin(ang + Math.PI / 2) * bendAmt + Math.cos(tt * 0.7) * 46;
        const mt = k * k * (3 - 2 * k);
        const x = (1 - mt) * (1 - mt) * bx + 2 * (1 - mt) * mt * cx + mt * mt * ex;
        const y = (1 - mt) * (1 - mt) * by + 2 * (1 - mt) * mt * cy + mt * mt * ey;
        const px = -(ey - by), py = ex - bx;
        const pl = Math.hypot(px, py) || 1;
        const wave = Math.sin(k * Math.PI * r.freq + tt * 2.2) * r.amp * Math.sin(k * Math.PI);
        return [x + (px / pl) * wave, y + (py / pl) * wave];
      }
      const x = k * (w + 200) - 100;
      const y = r.yBase * h + Math.sin(k * Math.PI * r.freq + tt * 1.8) * r.amp
        + Math.sin(k * Math.PI * 2.3 + tt) * r.amp * 0.35;
      return [x, y];
    };

    const draw = (time: number) => {
      const t = time / 1000;
      const dark = isDark();
      const [bx, by] = burst(t);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // ease spotlight toward the cursor
      mouse.sx += (mouse.x - mouse.sx) * 0.08;
      mouse.sy += (mouse.y - mouse.sy) * 0.08;

      // 1. Cursor spotlight — attaches the animation to the user's pointer/buttons
      if (mouse.sx > -100) {
        const sr = Math.min(w, h) * 0.32;
        const sg = ctx.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, sr);
        sg.addColorStop(0, `hsla(85, 90%, 62%, ${dark ? 0.10 : 0.05})`);
        sg.addColorStop(1, 'hsla(85, 90%, 62%, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(mouse.sx - sr, mouse.sy - sr, sr * 2, sr * 2);
      }

      // 2. Glow-burst emanation point (drifting + pulsing = bade-chote)
      const pulse = 1 + Math.sin(t * 1.4) * 0.14;
      const burstR = Math.min(w, h) * 0.13 * pulse;
      const bAlpha = dark ? 0.42 : 0.12;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, burstR);
      g.addColorStop(0, `hsla(80, 95%, 68%, ${bAlpha})`);
      g.addColorStop(0.4, `hsla(90, 90%, 60%, ${bAlpha * 0.5})`);
      g.addColorStop(1, 'hsla(90, 90%, 60%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - burstR, by - burstR, burstR * 2, burstR * 2);
      const core = ctx.createRadialGradient(bx, by, 0, bx, by, burstR * 0.3);
      core.addColorStop(0, `hsla(75, 100%, 80%, ${dark ? 0.85 : 0.3})`);
      core.addColorStop(1, 'hsla(75, 100%, 80%, 0)');
      ctx.fillStyle = core;
      ctx.fillRect(bx - burstR * 0.32, by - burstR * 0.32, burstR * 0.64, burstR * 0.64);

      // 3. Ribbons — glow pass + bright core, head-to-tail fade
      const heads: Array<[number, number, number]> = [];
      for (const r of ribbons) {
        const passes = dark ? [{ m: 4.2, a: 0.13 }, { m: 1, a: 1 }] : [{ m: 2.4, a: 0.15 }];
        for (const p of passes) {
          for (let s = 1; s <= SEG; s++) {
            const k0 = (s - 1) / SEG, k1 = s / SEG;
            const [x0, y0] = ribbonPoint(r, t, k0, bx, by);
            const [x1, y1] = ribbonPoint(r, t, k1, bx, by);
            const fade = Math.pow(1 - k1, 1.6);
            const a = r.alpha * fade * p.a * (dark ? 1 : 0.5);
            if (a < 0.004) continue;
            ctx.strokeStyle = `hsla(${r.hue}, ${r.sat}%, ${dark ? r.light : Math.max(30, r.light - 18)}%, ${a})`;
            ctx.lineWidth = Math.max(0.4, r.width * p.m * (0.5 + fade * 0.7));
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        }
        const [hx, hy] = ribbonPoint(r, t, 0.02, bx, by);
        heads.push([hx, hy, r.hue]);
        ctx.fillStyle = `hsla(${r.hue}, 100%, ${dark ? 82 : 55}%, ${r.alpha * (dark ? 0.9 : 0.45)})`;
        ctx.beginPath();
        ctx.arc(hx, hy, r.width * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Plexus — nodes drift, connect to each other and to ribbon heads
      const LINK = w < 640 ? 110 : 135;
      for (const n of nodes) {
        n.x += n.vx * 0.016; n.y += n.vy * 0.016;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
      }
      const linkAlpha = dark ? 0.16 : 0.10;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const al = linkAlpha * (1 - Math.sqrt(d2) / LINK);
            ctx.strokeStyle = `hsla(95, 85%, ${dark ? 64 : 42}%, ${al})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        // connect node to nearby ribbon heads — ribbons "attach" to the network
        for (const [hx, hy, hue] of heads) {
          const dx = a.x - hx, dy = a.y - hy;
          const d2 = dx * dx + dy * dy;
          const R = LINK * 0.85;
          if (d2 < R * R) {
            const al = (dark ? 0.28 : 0.16) * (1 - Math.sqrt(d2) / R);
            ctx.strokeStyle = `hsla(${hue}, 90%, ${dark ? 66 : 45}%, ${al})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(hx, hy); ctx.stroke();
          }
        }
        ctx.fillStyle = `hsla(90, 90%, ${dark ? 70 : 48}%, ${dark ? 0.55 : 0.35})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }

      // 5. Sparkle dust
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
      draw(900);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVis);
      return;
    }

    const loop = (time: number) => {
      if (!document.hidden) draw(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
    />
  );
}
