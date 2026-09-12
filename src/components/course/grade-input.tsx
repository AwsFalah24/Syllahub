"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact "score / max" entry. Commits on blur or Enter so every keystroke
 * doesn't hit the server; the parent updates optimistically.
 *
 * Parents should key this on the saved score/max so external changes reset it.
 */
export function GradeInput({
  score,
  maxScore,
  onCommit,
  className,
}: {
  score: number | null;
  maxScore: number;
  onCommit: (score: number | null, maxScore: number) => void;
  className?: string;
}) {
  const [s, setS] = useState(score == null ? "" : String(score));
  const [m, setM] = useState(String(maxScore));

  function commit() {
    const ns = s.trim() === "" ? null : Number(s);
    const nm = Number(m) > 0 ? Number(m) : 100;
    if (ns != null && Number.isNaN(ns)) return;
    if (ns === score && nm === maxScore) return;
    onCommit(ns, nm);
  }

  const pct = s.trim() !== "" && Number(m) > 0 ? (Number(s) / Number(m)) * 100 : null;

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-bg px-1.5 py-1 text-caption tabular ring-1 ring-line transition focus-within:ring-brand-400", className)}>
      <input
        inputMode="decimal"
        value={s}
        onChange={(e) => setS(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="—"
        aria-label="Score"
        className="w-10 bg-transparent text-right font-medium text-ink outline-none placeholder:text-ink-subtle"
      />
      <span className="text-ink-subtle">/</span>
      <input
        inputMode="decimal"
        value={m}
        onChange={(e) => setM(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Out of"
        className="w-9 bg-transparent text-ink-muted outline-none"
      />
      {pct != null ? (
        <span className={cn("ml-0.5 w-10 text-right text-micro font-semibold", pct >= 85 ? "text-success" : pct >= 60 ? "text-ink-muted" : "text-danger")}>
          {pct.toFixed(0)}%
        </span>
      ) : (
        <span className="ml-0.5 w-10" />
      )}
    </div>
  );
}
