import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays, addWeeks, endOfWeek, format, isBefore, isSameDay, max as maxDate, parseISO, startOfWeek } from "date-fns";
import { AlertTriangle, BookOpen, Clock, Settings2 } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getActiveCourses, getAssignmentsWithCourses, getMeetingsForCourses } from "@/lib/data";
import { localDate, nowInTz, WEEK_STARTS_ON, formatWeekLabel } from "@/lib/dates";
import { buildPlan, minToLabel, type PlanDay } from "@/lib/planner";
import { courseColor } from "@/lib/colors";
import { MEETING_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Plan" };

type Range = "week" | "month" | "term";

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const sp = await searchParams;
  const range: Range = sp.range === "month" ? "month" : sp.range === "term" ? "term" : "week";

  const [courses, assignmentsRaw] = await Promise.all([getActiveCourses(profile.id), getAssignmentsWithCourses(profile.id)]);
  const meetings = await getMeetingsForCourses(
    profile.id,
    courses.map((c) => c.id),
  );

  const now = nowInTz(profile.timezone);
  // Shift due dates into the user's wall-clock so the planner can reason in local time.
  const assignments = assignmentsRaw.map((a) => ({ ...a, due_at: a.due_at ? localDate(a.due_at, profile.timezone).toISOString() : null }));

  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  let from = weekStart;
  let to = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  if (range === "month") to = addDays(addWeeks(weekStart, 4), -1);
  if (range === "term") {
    const ends = courses.map((c) => (c.term_end ? parseISO(c.term_end) : null)).filter((d): d is Date => !!d);
    const lastDue = assignments.reduce<Date | null>((m, a) => (a.due_at ? maxDate([m ?? new Date(0), new Date(a.due_at)]) : m), null);
    const candidate = maxDate([...(ends.length ? ends : []), lastDue ?? addWeeks(now, 8)]);
    to = isBefore(candidate, addWeeks(now, 1)) ? addWeeks(now, 8) : candidate;
    if (isBefore(addWeeks(now, 20), to)) to = addWeeks(now, 20);
  }
  if (range === "week") from = weekStart;

  const plan = buildPlan({
    from,
    to,
    now,
    assignments,
    meetings,
    courses,
    prefs: {
      hoursPerDay: Number(profile.study_hours_per_day) || 3,
      startHour: profile.study_start_hour,
      endHour: profile.study_end_hour,
    },
  });

  const futureDays = plan.days.filter((d) => !isBefore(d.date, now) || isSameDay(d.date, now));

  return (
    <div>
      <PageHeader
        title="Your plan"
        description={
          courses.length === 0
            ? "Add a course and we'll build a study schedule around your classes."
            : `${plan.totalStudyHours} study ${plan.totalStudyHours === 1 ? "hour" : "hours"} planned · ${profile.study_hours_per_day}h/day between ${minToLabel(profile.study_start_hour * 60)} and ${minToLabel(profile.study_end_hour * 60)}.`
        }
        actions={
          <>
            <div className="flex rounded-xl bg-surface-2 p-1">
              {(["week", "month", "term"] as Range[]).map((r) => (
                <Link
                  key={r}
                  href={`/plan?range=${r}`}
                  className={cn(
                    "flex h-8 items-center rounded-lg px-3 text-caption font-semibold capitalize transition-all",
                    range === r ? "bg-bg text-ink shadow-soft" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {r}
                </Link>
              ))}
            </div>
            <Link href="/settings#planner">
              <Button variant="ghost" size="icon" aria-label="Planner settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>
          </>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Nothing to plan yet"
          description="Upload a syllabus to get a study plan built around your class times and deadlines."
          action={
            <Link href="/courses/new">
              <Button>Upload a syllabus</Button>
            </Link>
          }
        />
      ) : null}

      {plan.unscheduled.length ? (
        <div className="mb-8 flex gap-3 rounded-2xl bg-warning-soft px-4 py-3.5 text-caption text-[#8a5a00]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Tight squeeze</p>
            <p className="mt-0.5">
              Not enough study hours before these deadlines at your current daily budget:{" "}
              {plan.unscheduled.map((u) => `${u.task.title} (${u.hours}h short)`).join(", ")}. Consider raising your hours per
              day in settings.
            </p>
          </div>
        </div>
      ) : null}

      {courses.length > 0 && range === "week" ? <WeekPlan days={plan.days} now={now} /> : null}
      {courses.length > 0 && range !== "week" ? <LongPlan days={futureDays} now={now} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function WeekPlan({ days, now }: { days: PlanDay[]; now: Date }) {
  return (
    <div className="grid gap-3 md:grid-cols-7 md:gap-2">
      {days.map((d) => (
        <DayColumn key={d.key} day={d} now={now} />
      ))}
    </div>
  );
}

function DayColumn({ day, now }: { day: PlanDay; now: Date }) {
  const today = isSameDay(day.date, now);
  const past = isBefore(day.date, now) && !today;
  const timeline = [
    ...day.meetings.map((m) => ({ kind: "meeting" as const, start: m.startMin, item: m })),
    ...day.blocks.map((b) => ({ kind: "study" as const, start: b.startMin, item: b })),
  ].sort((a, b) => a.start - b.start);

  return (
    <section className={cn("rounded-2xl p-3", today ? "bg-brand-50/70" : "bg-surface", past && "opacity-60")}>
      <header className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-caption font-semibold uppercase tracking-wider", today ? "text-brand-700" : "text-ink-subtle")}>
            {format(day.date, "EEE")}
          </span>
          <span className={cn("text-h3 font-semibold tabular", today ? "text-brand-700" : "text-ink")}>{format(day.date, "d")}</span>
        </div>
        {day.studyHours > 0 ? (
          <span className="inline-flex items-center gap-1 text-micro font-medium text-ink-muted tabular">
            <Clock className="h-3 w-3" /> {day.studyHours}h
          </span>
        ) : null}
      </header>

      <div className="space-y-1.5">
        {timeline.map((t) =>
          t.kind === "meeting" ? (
            <div key={`m-${t.item.id}`} className="rounded-lg border-l-2 bg-bg/70 px-2 py-1.5 text-micro" style={{ borderColor: courseColor(t.item.course.color).hex }}>
              <div className="font-semibold text-ink">
                {t.item.course.code ?? t.item.course.name} <span className="font-normal text-ink-muted">{MEETING_KIND_LABELS[t.item.kind]}</span>
              </div>
              <div className="text-ink-muted tabular">
                {minToLabel(t.item.startMin)}–{minToLabel(t.item.endMin)}
                {t.item.location ? ` · ${t.item.location}` : ""}
              </div>
            </div>
          ) : (
            <Link
              key={`s-${t.item.task.id}-${t.item.startMin}`}
              href={`/courses/${t.item.task.course.id}`}
              className="block rounded-lg px-2 py-1.5 text-caption transition hover:brightness-95"
              style={{ backgroundColor: courseColor(t.item.task.course.color).soft }}
            >
              <div className="font-medium leading-snug" style={{ color: courseColor(t.item.task.course.color).text }}>
                {t.item.dueToday
                  ? "Finish: "
                  : t.item.ahead
                    ? "Get ahead: "
                    : t.item.task.type === "exam" || t.item.task.type === "quiz"
                      ? "Study: "
                      : "Work on: "}
                {t.item.task.title}
              </div>
              <div className="mt-0.5 text-micro text-ink-muted tabular">
                {minToLabel(t.item.startMin)}–{minToLabel(t.item.endMin)} · {t.item.task.course.code ?? t.item.task.course.name}
              </div>
            </Link>
          ),
        )}
        {day.due.length ? (
          <div className="pt-1">
            {day.due.map((t) => (
              <div key={`d-${t.id}`} className="flex items-center gap-1.5 px-1 text-micro font-semibold text-danger">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Due: {t.title}
              </div>
            ))}
          </div>
        ) : null}
        {timeline.length === 0 && day.due.length === 0 ? <p className="py-2 text-micro text-ink-subtle">{past ? "—" : "Free day"}</p> : null}
      </div>
    </section>
  );
}

function LongPlan({ days, now }: { days: PlanDay[]; now: Date }) {
  const weeks = new Map<string, PlanDay[]>();
  for (const d of days) {
    const k = format(startOfWeek(d.date, { weekStartsOn: WEEK_STARTS_ON }), "yyyy-MM-dd");
    const list = weeks.get(k) ?? [];
    list.push(d);
    weeks.set(k, list);
  }

  return (
    <div className="space-y-10">
      {[...weeks.entries()].map(([k, wdays]) => {
        const hours = wdays.reduce((s, d) => s + d.studyHours, 0);
        const due = wdays.flatMap((d) => d.due);
        return (
          <section key={k}>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-h3 font-semibold text-ink">Week of {formatWeekLabel(parseISO(k))}</h2>
              <span className="text-caption text-ink-muted tabular">
                {hours}h study · {due.length} due
              </span>
            </div>
            <ul className="divide-y divide-line/70">
              {wdays.map((d) => {
                const today = isSameDay(d.date, now);
                return (
                  <li key={d.key} className={cn("flex gap-4 py-2.5", today && "-mx-3 rounded-xl bg-brand-50/60 px-3")}>
                    <div className="w-12 shrink-0">
                      <div className={cn("text-micro font-semibold uppercase tracking-wider", today ? "text-brand-700" : "text-ink-subtle")}>{format(d.date, "EEE")}</div>
                      <div className={cn("text-body font-semibold tabular", today ? "text-brand-700" : "text-ink")}>{format(d.date, "d")}</div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {d.meetings.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-micro font-medium text-ink-2"
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: courseColor(m.course.color).hex }} />
                          {m.course.code ?? m.course.name} {minToLabel(m.startMin)}
                        </span>
                      ))}
                      {d.blocks.map((b) => {
                        const c = courseColor(b.task.course.color);
                        return (
                          <Link
                            key={`${b.task.id}-${b.startMin}`}
                            href={`/courses/${b.task.course.id}`}
                            className="inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-micro font-medium"
                            style={{ backgroundColor: c.soft, color: c.text }}
                          >
                            {b.task.title} · {(b.endMin - b.startMin) / 60}h
                          </Link>
                        );
                      })}
                      {d.due.map((t) => (
                        <span key={`due-${t.id}`} className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-micro font-semibold text-danger">
                          Due: {t.title}
                        </span>
                      ))}
                      {d.meetings.length + d.blocks.length + d.due.length === 0 ? <span className="text-micro text-ink-subtle">Free</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
