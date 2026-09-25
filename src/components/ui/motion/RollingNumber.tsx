import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springBouncy } from '../../../utils/motionTokens';

interface RollingNumberProps {
  value: number | string;
  className?: string;
  prefix?: string;
  suffix?: string;
  id?: string;
}

export const RollingNumber: React.FC<RollingNumberProps> = ({
  value,
  className = '',
  prefix = '',
  suffix = '',
  id,
}) => {
  const prevValueRef = useRef<number | string>(value);
  const [direction, setDirection] = useState<number>(1);

  useEffect(() => {
    const numCurrent = typeof value === 'number' ? value : parseFloat(String(value));
    const numPrev = typeof prevValueRef.current === 'number' ? prevValueRef.current : parseFloat(String(prevValueRef.current));

    if (!isNaN(numCurrent) && !isNaN(numPrev)) {
      setDirection(numCurrent >= numPrev ? 1 : -1);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <span id={id} className={`inline-flex items-center overflow-hidden font-mono ${className}`}>
      {prefix && <span className="mr-0.5">{prefix}</span>}
      <span className="relative inline-flex items-center justify-center min-w-[1ch] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={String(value)}
            initial={{
              y: direction > 0 ? '60%' : '-60%',
              opacity: 0,
              filter: 'blur(2px)',
            }}
            animate={{
              y: 0,
              opacity: 1,
              filter: 'blur(0px)',
            }}
            exit={{
              y: direction > 0 ? '-60%' : '60%',
              opacity: 0,
              filter: 'blur(2px)',
            }}
            transition={springBouncy}
            className="inline-block whitespace-nowrap"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
};
