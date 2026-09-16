"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { courseColor } from "@/lib/colors";
import { DAY_SHORT, formatTimeStr, WEEK_STARTS_ON, weekKey } from "@/lib/dates";
import { levelFor, loadScore, LOAD_STYLES } from "@/lib/load";
import { MEETING_KIND_LABELS, type AssignmentType, type MeetingKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface CalEvent {
  id: string;
  title: string;
  type: AssignmentType;
  /** Local date "yyyy-MM-dd" */
  date: string;
  time: string | null; // "HH:mm"
  completed: boolean;
  weight_percent: number | null;
  estimated_hours: number | null;
  courseId: string;
  courseCode: string;
  color: string;
  endTime?: string;
}

export interface CalMeeting {
  id: string;
  courseId: string;
  courseCode: string;
  color: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: MeetingKind;
  location: string | null;
  term_start: string | null;
  term_end: string | null;
}

export function CalendarView({
  events,
  meetings,
  initialView,
  initialDate,
  today,
}: {
  events: CalEvent[];
  meetings: CalMeeting[];
  initialView: "month" | "week";
  initialDate: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<"month" | "week">(initialView);
  const [cursor, setCursor] = useState(() => parseISO(initialDate));
  const todayDate = useMemo(() => parseISO(today), [today]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    for (const list of m.values()) list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return m;
  }, [events]);

  const weekLoad = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.completed) continue;
      const k = weekKey(parseISO(e.date));
      m.set(k, (m.get(k) ?? 0) + loadScore(e));
    }
    return m;
  }, [events]);

  function go(next: Date) {
    setCursor(next);
    router.replace(`${pathname}?view=${view}&date=${format(next, "yyyy-MM-dd")}`, { scroll: false });
  }
  function switchView(v: "month" | "week") {
    setView(v);
    router.replace(`${pathname}?view=${v}&date=${format(cursor, "yyyy-MM-dd")}`, { scroll: false });
  }

  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : (() => {
          const s = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
          const e = addDays(s, 6);
          return isSameMonth(s, e) ? `${format(s, "MMM d")} – ${format(e, "d, yyyy")}` : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
        })();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => go(view === "month" ? addMonths(cursor, -1) : addWeeks(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => go(view === "month" ? addMonths(cursor, 1) : addWeeks(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-h3 font-semibold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" className="ml-1 text-ink-muted" onClick={() => go(todayDate)}>
            Today
          </Button>
        </div>
        <div className="flex rounded-xl bg-surface-2 p-1">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              className={cn(
                "h-8 rounded-lg px-3 text-caption font-semibold capitalize transition-all",
                view === v ? "bg-bg text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid cursor={cursor} byDate={byDate} meetings={meetings} weekLoad={weekLoad} onPickDay={(d) => { setView("week"); setCursor(d); router.replace(`${pathname}?view=week&date=${format(d, "yyyy-MM-dd")}`, { scroll: false }); }} />
      ) : (
        <WeekView cursor={cursor} byDate={byDate} meetings={meetings} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MonthGrid({
  cursor,
  byDate,
  meetings,
  weekLoad,
  onPickDay,
}: {
  cursor: Date;
  byDate: Map<string, CalEvent[]>;
  meetings: CalMeeting[];
  weekLoad: Map<string, number>;
  onPickDay: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div>
      <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-px text-center text-micro font-semibold uppercase tracking-wider text-ink-subtle">
        <span />
        {dayOrder.map((d) => (
          <span key={d} className="py-1">
            {DAY_SHORT[d]}
          </span>
        ))}
      </div>
      <div className="mt-1 space-y-1">
        {weeks.map((week) => {
          const level = levelFor(weekLoad.get(weekKey(week[0])) ?? 0);
          const s = LOAD_STYLES[level];
          return (
            <div key={week[0].toISOString()} className="grid grid-cols-[28px_repeat(7,1fr)] gap-1">
              <div className="flex items-stretch justify-center py-1" title={`${s.label} week`}>
                <span className={cn("w-1.5 rounded-full", s.dot, level === "none" && "bg-surface-2")} />
              </div>
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const items = [...(byDate.get(key) ?? []), ...meetings.filter(m => meetingOn(m, day)).map(m => ({ id: `meeting-${m.id}`, title: `${m.courseCode} ${MEETING_KIND_LABELS[m.kind]}`, time: m.start_time, endTime: m.end_time, color: m.color, completed: false }))].sort((a,b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
                const inMonth = isSameMonth(day, cursor);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPickDay(day)}
                    className={cn(
                      "flex min-h-[72px] flex-col rounded-xl p-1.5 text-left transition-colors hover:bg-surface sm:min-h-[96px]",
                      !inMonth && "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-caption font-medium tabular",
                        isToday(day) ? "bg-brand-500 text-white" : "text-ink-2",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {items.map((e) => {
                        const c = courseColor(e.color);
                        return (
                          <span
                            key={e.id}
                            title={`${e.title} ${e.time ?? ''}${e.endTime ? `–${e.endTime}` : ''}`}
                            className={cn("block break-words rounded-md px-1 py-1 text-micro font-medium", e.completed && "line-through opacity-50")}
                            style={{ backgroundColor: c.soft, color: c.text }}
                          >
                            {e.time && <span className="block tabular">{formatTimeStr(e.time)}{e.endTime ? `–${formatTimeStr(e.endTime)}` : ''}</span>}{e.title}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, byDate, meetings }: { cursor: Date; byDate: Map<string, CalEvent[]>; meetings: CalMeeting[] }) {
  const start = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid gap-3 md:grid-cols-7 md:gap-2">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const items = byDate.get(key) ?? [];
        const dayMeetings = meetings.filter((m) => meetingOn(m, day)).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const today = isToday(day);
        return (
          <section key={key} className={cn("rounded-2xl p-3", today ? "bg-brand-50/70" : "bg-surface")}>
            <header className="mb-2 flex items-baseline gap-1.5">
              <span className={cn("text-caption font-semibold uppercase tracking-wider", today ? "text-brand-700" : "text-ink-subtle")}>
                {format(day, "EEE")}
              </span>
              <span className={cn("text-h3 font-semibold tabular", today ? "text-brand-700" : "text-ink")}>{format(day, "d")}</span>
            </header>
            <div className="space-y-1.5">
              {dayMeetings.map((m) => {
                const c = courseColor(m.color);
                return (
                  <div key={m.id} className="rounded-lg border-l-2 bg-bg/70 px-2 py-1.5 text-micro" style={{ borderColor: c.hex }}>
                    <div className="font-semibold text-ink">{m.courseCode}</div>
                    <div className="text-ink-muted tabular">
                      {formatTimeStr(m.start_time)}–{formatTimeStr(m.end_time)} · {MEETING_KIND_LABELS[m.kind]}
                    </div>
                  </div>
                );
              })}
              {items.map((e) => {
                const c = courseColor(e.color);
                return (
                  <Link
                    key={e.id}
                    href={e.courseId ? `/courses/${e.courseId}` : '/plan'}
                    className={cn("block rounded-lg px-2 py-1.5 text-caption transition hover:brightness-95", e.completed && "opacity-50")}
                    style={{ backgroundColor: c.soft }}
                  >
                    <div className={cn("font-medium leading-snug", e.completed && "line-through")} style={{ color: c.text }}>
                      {e.title}
                    </div>
                    <div className="mt-0.5 text-micro text-ink-muted">
                      {e.courseCode}
                      {e.time ? ` · ${formatTimeStr(e.time)}` : ""}
                      {e.endTime ? `–${formatTimeStr(e.endTime)}` : ''}
                      {e.type === "exam" || e.type === "quiz" ? ` · ${e.type}` : ""}
                    </div>
                  </Link>
                );
              })}
              {items.length === 0 && dayMeetings.length === 0 ? <p className="py-2 text-micro text-ink-subtle">Nothing scheduled</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function isSameDayStr(a: string, b: Date) {
  return isSameDay(parseISO(a), b);
}

function meetingOn(m: CalMeeting, day: Date) {
  const date = format(day, 'yyyy-MM-dd');
  return m.day_of_week === day.getDay() && (!m.term_start || date >= m.term_start) && (!m.term_end || date <= m.term_end);
}
