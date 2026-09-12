import Link from "next/link";
import { format } from "date-fns";
import { formatWeekLabel } from "@/lib/dates";
import { LOAD_STYLES, type WeekLoad } from "@/lib/load";
import { cn } from "@/lib/utils";

/**
 * Compact heat strip: one cell per upcoming week, tinted by workload.
 * Purple intensity = busier week.
 */
export function WeekLoadStrip({ weeks }: { weeks: WeekLoad[] }) {
  return (
    <div>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {weeks.map((w, i) => {
          const s = LOAD_STYLES[w.level];
          return (
            <Link
              key={w.key}
              href={`/calendar?view=week&date=${format(w.weekStart, "yyyy-MM-dd")}`}
              title={`${formatWeekLabel(w.weekStart)} · ${s.label} · ${w.count} due`}
              className={cn(
                "group flex min-w-[64px] flex-1 flex-col items-center rounded-xl px-2 py-2 transition-transform hover:-translate-y-0.5",
                s.bg,
              )}
            >
              <span className={cn("text-micro font-semibold uppercase tracking-wider", s.text, w.level === "none" && "text-ink-subtle")}>
                {i === 0 ? "Now" : format(w.weekStart, "MMM d")}
              </span>
              <span className={cn("mt-0.5 text-h3 font-semibold tabular", s.text)}>{w.count}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-micro text-ink-subtle">
        {(["light", "moderate", "heavy"] as const).map((lvl) => (
          <span key={lvl} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-sm", LOAD_STYLES[lvl].dot)} />
            {LOAD_STYLES[lvl].label}
          </span>
        ))}
        <span className="ml-auto hidden sm:inline">Number = items due that week</span>
      </div>
    </div>
  );
}
