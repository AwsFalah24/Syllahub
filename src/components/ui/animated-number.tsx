"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/**
 * Smoothly animates between numeric values instead of snapping.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
  duration = 0.7,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const mv = useMotionValue(value);
  const first = useRef(true);
  const text = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, mv, duration]);

  return <motion.span className={className}>{text}</motion.span>;
}
