import { NextResponse } from "next/server";
import { addWeeks, format, nextDay, parseISO, startOfDay, type Day } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { createEvents, type EventAttributes } from "ics";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assignment, Course, CourseMeeting, Profile } from "@/lib/types";
import { ASSIGNMENT_TYPE_LABELS, MEETING_KIND_LABELS } from "@/lib/types";
import { getSiteUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Public, token-authenticated ICS feed. Students paste this URL into Google /
 * Apple Calendar to subscribe. Rotating the token in settings invalidates it.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/ics/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("ics_token", token).maybeSingle();
  if (!profile) return new NextResponse("Not found", { status: 404 });
  const p = profile as Profile;

  const { data: coursesData } = await admin.from("courses").select("*").eq("user_id", p.id).eq("archived", false);
  const courses = (coursesData as Course[]) ?? [];
  const courseIds = courses.map((c) => c.id);
  const byId = new Map(courses.map((c) => [c.id, c]));

  const [{ data: aData }, { data: mData }] = await Promise.all([
    courseIds.length
      ? admin.from("assignments").select("*").in("course_id", courseIds).not("due_at", "is", null)
      : Promise.resolve({ data: [] as Assignment[] }),
    courseIds.length ? admin.from("course_meetings").select("*").in("course_id", courseIds) : Promise.resolve({ data: [] as CourseMeeting[] }),
  ]);

  const site = getSiteUrl();
  const events: EventAttributes[] = [];

  for (const a of (aData as Assignment[]) ?? []) {
    const course = byId.get(a.course_id);
    if (!course || !a.due_at) continue;
    const label = `${course.code ?? course.name}: ${a.title}`;
    const description = [
      ASSIGNMENT_TYPE_LABELS[a.type],
      a.weight_percent ? `Worth ${a.weight_percent}%` : null,
      a.notes,
      `${site}/courses/${course.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (a.all_day) {
      const d = formatInTimeZone(a.due_at, p.timezone, "yyyy-MM-dd").split("-").map(Number) as [number, number, number];
      events.push({
        uid: `${a.id}@syllahub`,
        title: label,
        start: d,
        end: [d[0], d[1], d[2] + 1] as [number, number, number],
        description,
        url: `${site}/courses/${course.id}`,
        status: a.completed ? "CONFIRMED" : "TENTATIVE",
        calName: "SyllaHub",
      });
    } else {
      const due = new Date(a.due_at);
      events.push({
        uid: `${a.id}@syllahub`,
        title: label,
        start: [due.getUTCFullYear(), due.getUTCMonth() + 1, due.getUTCDate(), due.getUTCHours(), due.getUTCMinutes()],
        startInputType: "utc",
        startOutputType: "utc",
        duration: { minutes: 30 },
        description,
        url: `${site}/courses/${course.id}`,
        calName: "SyllaHub",
      });
    }
  }

  // Weekly class meetings, recurring across the term (or the next 16 weeks).
  const today = startOfDay(new Date());
  for (const m of (mData as CourseMeeting[]) ?? []) {
    const course = byId.get(m.course_id);
    if (!course) continue;
    const anchor = course.term_start ? parseISO(course.term_start) : today;
    const first = anchor.getDay() === m.day_of_week ? anchor : nextDay(anchor, m.day_of_week as Day);
    const until = course.term_end ? parseISO(course.term_end) : addWeeks(today, 16);
    const [sh, sm] = m.start_time.split(":").map(Number);
    const [eh, em] = m.end_time.split(":").map(Number);
    events.push({
      uid: `${m.id}@syllahub`,
      title: `${course.code ?? course.name} ${MEETING_KIND_LABELS[m.kind]}`,
      start: [first.getFullYear(), first.getMonth() + 1, first.getDate(), sh, sm],
      end: [first.getFullYear(), first.getMonth() + 1, first.getDate(), eh, em],
      location: m.location ?? undefined,
      recurrenceRule: `FREQ=WEEKLY;BYDAY=${BYDAY[m.day_of_week]};UNTIL=${format(until, "yyyyMMdd")}T235959Z`,
      calName: "SyllaHub",
    });
  }

  const { error, value } = createEvents(events);
  if (error || !value) {
    console.error("[ics] failed", error);
    return new NextResponse("Could not build calendar", { status: 500 });
  }

  // Add timezone hint for floating meeting times.
  const body = value.replace("PRODID:", `X-WR-CALNAME:SyllaHub\r\nX-WR-TIMEZONE:${p.timezone}\r\nPRODID:`);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="syllahub.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
