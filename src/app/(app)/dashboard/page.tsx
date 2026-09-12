import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, Plus, Sparkles, Upload } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getActiveCourses, getAssignmentsWithCourses, getComponentsForCourses } from "@/lib/data";
import { BUCKET_LABELS, bucketFor, localDate, nowInTz, relativeDue, type Bucket } from "@/lib/dates";
import { weekLoads } from "@/lib/load";
import { computeStanding, letterFor } from "@/lib/grades";
import { courseColor } from "@/lib/colors";
import type { AssignmentWithCourse } from "@/lib/types";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeadlineItem } from "@/components/dashboard/deadline-item";
import { WeekLoadStrip } from "@/components/dashboard/week-load-strip";
import { GradeRing } from "@/components/grades/grade-ring";

export const metadata: Metadata = { title: "Timeline" };

const ORDER: Bucket[] = ["overdue", "today", "thisWeek", "nextWeek", "later", "undated"];

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const [courses, assignments] = await Promise.all([
    getActiveCourses(profile.id),
    getAssignmentsWithCourses(profile.id),
  ]);

  if (courses.length === 0) {
    return <FirstRun name={profile.full_name} />;
  }

  const components = await getComponentsForCourses(
    profile.id,
    courses.map((c) => c.id),
  );
  const now = nowInTz(profile.timezone);

  const groups = new Map<Bucket, AssignmentWithCourse[]>();
  for (const a of assignments) {
    if (a.completed && a.due_at && localDate(a.due_at, profile.timezone) < now) continue; // hide finished past work
    const due = a.due_at ? localDate(a.due_at, profile.timezone) : null;
    const b = bucketFor(due, now);
    if (b === "overdue" && a.completed) continue;
    const list = groups.get(b) ?? [];
    list.push(a);
    groups.set(b, list);
  }

  const upcomingCount = (groups.get("today")?.length ?? 0) + (groups.get("thisWeek")?.length ?? 0);
  const weeks = weekLoads(assignments, now, 10, profile.timezone);
  const firstName = profile.full_name?.split(" ")[0];

  return (
    <div>
      <PageHeader
        eyebrow={format(now, "EEEE, MMMM d")}
        title={firstName ? `Hey ${firstName}` : "Your timeline"}
        description={
          upcomingCount === 0
            ? "Nothing due this week. Enjoy it — or get ahead with the plan."
            : `${upcomingCount} ${upcomingCount === 1 ? "thing" : "things"} due this week across ${courses.length} ${courses.length === 1 ? "course" : "courses"}.`
        }
        actions={
          <Link href="/courses/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add syllabus
            </Button>
          </Link>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
        {/* Agenda */}
        <section>
          <div className="mb-8">
            <SectionTitle aside={<Link href="/calendar" className="hover:text-ink">Open calendar →</Link>}>
              Semester load
            </SectionTitle>
            <WeekLoadStrip weeks={weeks} />
          </div>

          {ORDER.map((bucket) => {
            const items = groups.get(bucket);
            if (!items?.length) return null;
            if (bucket === "later" && items.length > 12) {
              // Keep "Later" scannable; the calendar has the rest.
              items.splice(12);
            }
            return (
              <div key={bucket} className="mb-8">
                <div className="mb-1.5 flex items-baseline gap-2 px-2">
                  <h2
                    className={
                      bucket === "overdue"
                        ? "text-caption font-semibold uppercase tracking-wider text-danger"
                        : bucket === "today"
                          ? "text-caption font-semibold uppercase tracking-wider text-brand-600"
                          : "eyebrow"
                    }
                  >
                    {BUCKET_LABELS[bucket]}
                  </h2>
                  <span className="text-micro text-ink-subtle tabular">{items.length}</span>
                </div>
                <ul className="-mx-2">
                  {items.map((a) => {
                    const due = a.due_at ? localDate(a.due_at, profile.timezone) : null;
                    return (
                      <DeadlineItem
                        key={a.id}
                        item={a}
                        dueLabel={due ? relativeDue(due, now, a.all_day) : "No date"}
                        urgent={bucket === "today"}
                        overdue={bucket === "overdue"}
                      />
                    );
                  })}
                </ul>
                {bucket === "later" ? (
                  <Link
                    href="/calendar"
                    className="mt-2 inline-flex items-center gap-1 px-2 text-caption font-medium text-brand-600 hover:text-brand-700"
                  >
                    See everything in the calendar <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            );
          })}

          {assignments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No deadlines yet"
              description="Your courses don't have any dated work. Add deadlines from a course page."
              action={
                <Link href="/courses">
                  <Button variant="secondary">Go to courses</Button>
                </Link>
              }
            />
          ) : null}
        </section>

        {/* Side: grades + plan */}
        <aside className="space-y-10">
          <div>
            <SectionTitle aside={<Link href="/courses" className="hover:text-ink">All courses →</Link>}>Where you stand</SectionTitle>
            <ul className="space-y-1">
              {courses.map((course) => {
                const standing = computeStanding(
                  components.filter((c) => c.course_id === course.id),
                  assignments.filter((a) => a.course_id === course.id),
                );
                const color = courseColor(course.color);
                return (
                  <li key={course.id}>
                    <Link
                      href={`/courses/${course.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface"
                    >
                      <GradeRing value={standing.current} size={44} stroke={5} color={color.hex} marker={course.target_grade}>
                        <span className="text-micro font-semibold tabular text-ink">{letterFor(standing.current)}</span>
                      </GradeRing>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{course.code ?? course.name}</span>
                        <span className="block truncate text-caption text-ink-muted">
                          {standing.current == null
                            ? "No grades yet"
                            : `${standing.current.toFixed(1)}% · target ${course.target_grade}%`}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-ink-subtle" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href="/plan"
            className="group block rounded-2xl bg-surface p-5 transition hover:bg-brand-50"
          >
            <div className="flex items-center gap-2 text-brand-600">
              <Sparkles className="h-4 w-4" />
              <span className="text-caption font-semibold uppercase tracking-wider">Weekly plan</span>
            </div>
            <p className="mt-2 text-body text-ink-2">
              A study schedule built around your class times and what&apos;s due next.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-caption font-semibold text-brand-600 group-hover:gap-1.5">
              Open plan <ArrowRight className="h-3.5 w-3.5 transition-all" />
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function FirstRun({ name }: { name: string | null }) {
  const first = name?.split(" ")[0];
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-6 text-center sm:pt-16">
      <div className="relative mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 shadow-soft">
          <Upload className="h-8 w-8" />
        </div>
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white shadow-brand">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>
      <h1 className="text-display font-semibold text-ink">{first ? `Welcome, ${first}.` : "Welcome."}</h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-muted">
        Upload one syllabus and we&apos;ll turn it into a timeline of deadlines, a grade tracker, and reminders — in
        about 20 seconds.
      </p>
      <Link href="/courses/new" className="mt-8">
        <Button size="lg" className="px-8">
          <Upload className="h-4 w-4" /> Upload your first syllabus
        </Button>
      </Link>
      <ul className="mt-14 grid w-full gap-6 text-left sm:grid-cols-3">
        {[
          ["Every deadline", "Assignments, readings, quizzes and exams — pulled from the PDF and sorted by week."],
          ["Live grade tracking", "Log grades as they land and see exactly what you need on the final."],
          ["Smart reminders", "Push and email nudges 3 days and 1 day before anything is due."],
        ].map(([t, d]) => (
          <li key={t}>
            <h3 className="text-body font-semibold text-ink">{t}</h3>
            <p className="mt-1 text-caption text-ink-muted">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
