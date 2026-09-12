"use client";

import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { letterFor, remainingNames, TARGET_PRESETS, whatDoINeed, type CourseStanding } from "@/lib/grades";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { GradeRing } from "./grade-ring";

export function GradeHero({
  standing,
  target,
  onTargetChange,
  colorHex,
}: {
  standing: CourseStanding;
  target: number;
  onTargetChange: (t: number) => void;
  colorHex: string;
}) {
  const need = whatDoINeed(standing, target);
  const names = remainingNames(standing);
  const remainingLabel =
    names.length === 0 ? "" : names.length === 1 ? `the ${names[0]}` : names.length === 2 ? `${names[0]} and ${names[1]}` : `your remaining ${names.length} components`;

  return (
    <section className="card-soft grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
      {/* Ring */}
      <div className="flex items-center justify-center">
        <GradeRing value={standing.current} size={188} stroke={14} color={colorHex} marker={target}>
          <span className="eyebrow">Current</span>
          <span className="mt-0.5 text-[40px] font-semibold leading-none tracking-tight text-ink tabular">
            {standing.current == null ? "—" : <AnimatedNumber value={standing.current} decimals={1} />}
          </span>
          <span className="mt-1 text-caption font-medium text-ink-muted">
            {standing.current == null ? "no grades yet" : letterFor(standing.current)}
          </span>
        </GradeRing>
      </div>

      {/* What do I need */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-ink-2">
            <Target className="h-4 w-4 text-brand-600" /> Target
          </span>
          <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
            {TARGET_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onTargetChange(p.value)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-2.5 text-caption font-semibold transition-all",
                  target === p.value ? "bg-brand-500 text-white shadow-brand/40" : "bg-bg text-ink-2 hover:bg-surface-2",
                )}
              >
                {p.label} <span className="ml-0.5 font-medium opacity-70 tabular">{p.value}</span>
              </button>
            ))}
            <label className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-bg px-2.5 text-caption font-medium text-ink-2">
              <input
                type="number"
                min={0}
                max={100}
                value={target}
                onChange={(e) => onTargetChange(Number(e.target.value))}
                className="w-9 bg-transparent text-right tabular outline-none"
                aria-label="Custom target grade"
              />
              %
            </label>
          </div>
        </div>

        <div className="mt-5">
          <NeedMessage need={need} remainingLabel={remainingLabel} standing={standing} />
        </div>

        {need.status === "reachable" || need.status === "secured" || need.status === "unreachable" ? (
          <div className="mt-5">
            <div className="relative h-3 overflow-hidden rounded-full bg-bg">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: need.status === "unreachable" ? "var(--color-danger)" : colorHex }}
                initial={false}
                animate={{ width: `${need.neededDisplay ?? 0}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
              {standing.current != null ? (
                <motion.span
                  className="absolute top-0 h-3 w-0.5 bg-ink/60"
                  initial={false}
                  animate={{ left: `${Math.min(100, standing.current)}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  title="Your current average"
                />
              ) : null}
            </div>
            <div className="mt-1.5 flex justify-between text-micro text-ink-subtle tabular">
              <span>0%</span>
              {standing.current != null ? <span>current avg {standing.current.toFixed(0)}%</span> : null}
              <span>100%</span>
            </div>
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-3 gap-4 text-caption">
          <Stat label="Graded so far" value={`${standing.lockedWeight.toFixed(0)}%`} sub="of the course" />
          <Stat label="Best case" value={`${standing.maxPossible.toFixed(1)}%`} sub={letterFor(standing.maxPossible)} />
          <Stat label="Worst case" value={`${standing.minPossible.toFixed(1)}%`} sub={letterFor(standing.minPossible)} />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-h3 font-semibold text-ink tabular">{value}</dd>
      <dd className="text-micro text-ink-subtle">{sub}</dd>
    </div>
  );
}

function NeedMessage({
  need,
  remainingLabel,
  standing,
}: {
  need: ReturnType<typeof whatDoINeed>;
  remainingLabel: string;
  standing: CourseStanding;
}) {
  const big = "text-[32px] font-semibold leading-none tracking-tight tabular sm:text-[36px]";

  switch (need.status) {
    case "no-data":
      return (
        <p className="text-body text-ink-muted">
          Add a grading breakdown (e.g. Midterm 25%) to see what you need on each piece of work.
        </p>
      );
    case "locked":
      return (
        <div>
          <p className="text-caption text-ink-muted">Everything is graded. Your final grade is</p>
          <p className={cn(big, "mt-1 text-ink")}>
            <AnimatedNumber value={need.finalIfLocked ?? 0} decimals={1} suffix="%" />
            <span className="ml-2 text-h3 font-medium text-ink-muted">{letterFor(need.finalIfLocked)}</span>
          </p>
        </div>
      );
    case "secured":
      return (
        <div>
          <p className="text-caption text-ink-muted">You&apos;ve already locked in {need.target}% — anything on {remainingLabel} keeps it.</p>
          <p className={cn(big, "mt-1 text-success")}>
            {letterFor(need.target)} secured
          </p>
        </div>
      );
    case "unreachable":
      return (
        <div>
          <p className="text-caption text-ink-muted">
            {need.target}% is out of reach — even 100% on {remainingLabel} would land you at
          </p>
          <p className={cn(big, "mt-1 text-danger")}>
            <AnimatedNumber value={standing.maxPossible} decimals={1} suffix="%" />
            <span className="ml-2 text-h3 font-medium text-ink-muted">{letterFor(standing.maxPossible)}</span>
          </p>
          <p className="mt-1 text-caption text-ink-muted">Try a lower target to see what&apos;s realistic.</p>
        </div>
      );
    default:
      return (
        <div>
          <p className="text-caption text-ink-muted">To finish with {letterFor(need.target)} ({need.target}%), you need at least</p>
          <p className={cn(big, "mt-1 text-ink")}>
            <AnimatedNumber value={need.needed ?? 0} decimals={0} suffix="%" />
            <span className="ml-2 text-h3 font-medium text-ink-muted">on {remainingLabel || "remaining work"}</span>
          </p>
        </div>
      );
  }
}
