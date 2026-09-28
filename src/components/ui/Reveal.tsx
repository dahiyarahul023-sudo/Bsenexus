import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Reveal — scroll-triggered entrance: fades in while scaling up
 * (chota → bada) with a soft rise. Applied to section headers down
 * the landing page.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  scale = 0.94,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
