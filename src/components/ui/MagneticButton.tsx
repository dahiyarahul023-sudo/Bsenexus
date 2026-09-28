import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { motion } from 'framer-motion';

/**
 * MagneticButton — the button leans toward the cursor inside a generous
 * hover field, then springs back on leave. Gives CTAs a physical,
 * "attached to the pointer" feel.
 */
export default function MagneticButton({
  children,
  className = '',
  strength = 0.35,
  maxPull = 9,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  maxPull?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const range = 150;
    if (dist < range) {
      const pull = Math.min(maxPull, (1 - dist / range) * maxPull * 2.2);
      setPos({ x: (dx / dist) * pull * strength * 3, y: (dy / dist) * pull * strength * 3 });
    } else {
      setPos({ x: 0, y: 0 });
    }
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.6 }}
      className={`inline-block p-4 -m-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
