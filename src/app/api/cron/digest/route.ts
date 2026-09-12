import { NextResponse } from "next/server";
import { addDays, endOfWeek, isSameDay, isSameWeek, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/notifications/cron-auth";
import { digestEmail, sendEmail } from "@/lib/notifications/email";
import { WEEK_STARTS_ON } from "@/lib/dates";
import { ASSIGNMENT_TYPE_LABELS, type Assignment, type Course, type Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Local hour at which digests go out. */
const SEND_HOUR = 7;

/**
 * Runs hourly. Sends a "here's what's due" email at 7am local time:
 *  - daily digests every day (covers today + tomorrow),
 *  - weekly digests on Monday (covers the week).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profilesData } = await admin.from("profiles").select("*").neq("digest", "none").not("email", "is", null);
  const profiles = (profilesData as Profile[]) ?? [];

  let sent = 0;
  const nowUtc = new Date();

  for (const p of profiles) {
    const local = toZonedTime(nowUtc, p.timezone);
    if (local.getHours() !== SEND_HOUR) continue;

    const last = p.last_digest_at ? toZonedTime(p.last_digest_at, p.timezone) : null;
    if (p.digest === "daily" && last && isSameDay(last, local)) continue;
    if (p.digest === "weekly") {
      if (local.getDay() !== WEEK_STARTS_ON) continue;
      if (last && isSameWeek(last, local, { weekStartsOn: WEEK_STARTS_ON })) continue;
    }

    const { data: coursesData } = await admin.from("courses").select("*").eq("user_id", p.id).eq("archived", false);
    const courses = (coursesData as Course[]) ?? [];
    if (!courses.length) continue;
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const rangeStartLocal = startOfDay(local);
    const rangeEndLocal = p.digest === "daily" ? addDays(rangeStartLocal, 2) : addDays(endOfWeek(local, { weekStartsOn: WEEK_STARTS_ON }), 1);
    const rangeStart = fromZonedTime(rangeStartLocal, p.timezone).toISOString();
    const rangeEnd = fromZonedTime(rangeEndLocal, p.timezone).toISOString();

    const { data: aData } = await admin
      .from("assignments")
      .select("*")
      .eq("user_id", p.id)
      .eq("completed", false)
      .in(
        "course_id",
        courses.map((c) => c.id),
      )
      .gte("due_at", rangeStart)
      .lt("due_at", rangeEnd)
      .order("due_at");
    const items = ((aData as Assignment[]) ?? []).map((a) => {
      const c = courseById.get(a.course_id)!;
      return {
        title: a.title,
        courseLabel: c.code ?? c.name,
        dueLabel: formatInTimeZone(a.due_at!, p.timezone, a.all_day ? "EEE, MMM d" : "EEE, MMM d 'at' h:mm a"),
        courseId: c.id,
        type: ASSIGNMENT_TYPE_LABELS[a.type],
      };
    });

    const { subject, html, text } = digestEmail(p.full_name, items, p.digest === "daily" ? "today and tomorrow" : "this week");
    const ok = await sendEmail(p.email!, subject, html, text);
    if (ok) {
      sent += 1;
      await admin.from("profiles").update({ last_digest_at: nowUtc.toISOString() }).eq("id", p.id);
    }
  }

  return NextResponse.json({ ok: true, candidates: profiles.length, sent });
}
