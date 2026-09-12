"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Radial progress ring. `value` 0–100. Optional `marker` draws a tick at the
 * target grade so the gap between current and target is visible at a glance.
 */
export function GradeRing({
  value,
  size = 160,
  stroke = 12,
  color = "var(--color-brand-500)",
  track = "var(--color-surface-2)",
  marker,
  children,
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  marker?: number | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const offset = c - (pct / 100) * c;

  const markerAngle = marker != null ? (marker / 100) * 360 - 90 : null;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: value == null ? c : offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {markerAngle != null ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[calc(100%-2px)] w-0.5 origin-center"
          style={{ transform: `translate(-50%, -50%) rotate(${markerAngle + 90}deg)` }}
        >
          <span className="absolute left-0 top-0 w-full rounded-full bg-ink" style={{ height: stroke + 4, marginTop: -1 }} />
        </span>
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
