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

// Physics-Based Micro-Interaction Springs (from Apple & High-Craft design specs)
export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 20,
  mass: 0.7
};

export const springElastic: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 16,
  mass: 0.6
};

export const springSmoothPill: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 28,
  mass: 0.75
};

// Tab Bar Icon Bounce (squash & stretch anticipation on activate)
export const tabIconBounceVariants: Variants = {
  idle: {
    scale: 1,
    y: 0,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 450,
      damping: 24,
    },
  },
  active: {
    scale: 1.14,
    y: -1.5,
    rotate: 0,
    transition: springBouncy,
  },
};

// Star / Bookmark Pop & Sparkle
export const starPopVariants: Variants = {
  idle: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 450,
      damping: 24,
    },
  },
  popped: {
    scale: 1.16,
    rotate: 10,
    transition: springElastic,
  },
};

// Origin-based Spatial Expansion (for menus, action bars, share sheets)
export const originExpansionVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.7,
    y: 6,
    transformOrigin: 'bottom center',
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 25,
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: 4,
    filter: 'blur(2px)',
    transition: {
      duration: 0.12,
      ease: 'easeOut',
    },
  },
};

// Numeric Stepper / Rolling Number Variants
export const numberScrollVariants: Variants = {
  initial: (direction: number = 1) => ({
    y: direction > 0 ? 12 : -12,
    opacity: 0,
    filter: 'blur(2px)',
  }),
  animate: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: springBouncy,
  },
  exit: (direction: number = 1) => ({
    y: direction > 0 ? -12 : 12,
    opacity: 0,
    filter: 'blur(2px)',
    transition: { duration: 0.12, ease: 'easeIn' },
  }),
};


