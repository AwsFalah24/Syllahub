import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getActiveCourses, getAssignmentsWithCourses, getMeetingsForCourses } from "@/lib/data";
import { fromDueAt, nowInTz } from "@/lib/dates";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CalendarView, type CalEvent, type CalMeeting } from "@/components/calendar/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "month";
  const now = nowInTz(profile.timezone);
  const today = format(now, "yyyy-MM-dd");
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [courses, assignments] = await Promise.all([getActiveCourses(profile.id), getAssignmentsWithCourses(profile.id)]);
  const meetings = await getMeetingsForCourses(
    profile.id,
    courses.map((c) => c.id),
  );

  const events: CalEvent[] = assignments
    .filter((a) => a.due_at)
    .map((a) => {
      const { date, time } = fromDueAt(a.due_at!, profile.timezone, a.all_day);
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        date,
        time,
        completed: a.completed,
        weight_percent: a.weight_percent,
        estimated_hours: a.estimated_hours,
        courseId: a.course_id,
        courseCode: a.course.code ?? a.course.name,
        color: a.course.color,
      };
    });

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const calMeetings: CalMeeting[] = meetings.map((m) => {
    const c = courseById.get(m.course_id)!;
    return {
      id: m.id,
      courseId: m.course_id,
      courseCode: c.code ?? c.name,
      color: c.color,
      day_of_week: m.day_of_week,
      start_time: m.start_time.slice(0, 5),
      end_time: m.end_time.slice(0, 5),
      kind: m.kind,
      location: m.location,
    };
  });

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Every deadline and class, by month or week. The rail on the left shows how heavy each week is."
        actions={
          <Link href="/settings#calendar">
            <Button variant="outline" size="sm">
              <CalendarPlus className="h-4 w-4" /> Subscribe in Google / Apple
            </Button>
          </Link>
        }
      />
      <CalendarView events={events} meetings={calMeetings} initialView={view} initialDate={date} today={today} />
    </div>
  );
}
