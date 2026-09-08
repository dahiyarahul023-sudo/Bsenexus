import type { Transition, Variants } from 'framer-motion';

// Apple Design Spec: Critically Damped Standard Spring (Response 0.35s, Damping 1.0 = No overshoot)
export const springStandard: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8
};

// Apple Snappy Spring (Response 0.28s for instant responsive UI widgets)
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.7
};

// Momentum / Flick Spring (Response 0.4s, slight bounce 0.15 for drag / throw handoff)
export const springMomentum: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
  mass: 0.9
};

// Gentle Sheet / Modal Spring
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 28,
  mass: 1
};

// Aliases for compatibility across existing components
export const springMorph: Transition = springStandard;
export const springStagger: Transition = springStandard;

// Accordions, Dropdowns & Collapsible Panels
export const accordionTransition: Transition = springSnappy;

// Apple-Grade Interactive Micro-interactions (Tactile pointer-down responses)
export const hoverScale = { scale: 1.015, y: -1, transition: springSnappy };
export const cardHover = { scale: 1.008, y: -1, transition: springSnappy };
export const tapScale = { scale: 0.96, transition: springSnappy };
export const buttonTap = { scale: 0.96, transition: springSnappy };
export const iconTap = { scale: 0.92, transition: springSnappy };
export const subtleHover = { opacity: 0.9, transition: springSnappy };

// Container Variants for Staggered Lists / Feeds
export const containerStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06
    }
  }
};

// Item Variants for Card Grids / Feeds
export const itemFadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springStandard
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -4,
    transition: { duration: 0.1 }
  }
};

// Spring Feed Entries for Notification Inbox
export const notificationItemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springStandard
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.12 }
  }
};

// Modal / Dialog Morph Variants
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12, ease: 'easeIn' }
  }
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springStandard
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.11 }
  }
};

// Collapsible Accordion Variants
export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: springStandard
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: springStandard
  }
};

// Badge & Indicator Pulse
export const pulseTransition: Transition = {
  duration: 1.4,
  repeat: Infinity,
  repeatType: 'reverse',
  ease: 'easeInOut'
};


