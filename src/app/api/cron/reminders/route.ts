import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/notifications/cron-auth";
import { reminderEmail, sendEmail } from "@/lib/notifications/email";
import { sendPushToUser } from "@/lib/notifications/push";
import { ASSIGNMENT_TYPE_LABELS, type Assignment, type Course, type Profile } from "@/lib/types";
import { getSiteUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A reminder fires within this window after its scheduled time; older ones are skipped, not spammed. */
const WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Runs hourly. For each user and each of their `reminder_days` (default 3 and 1),
 * sends a push and/or email when `due_at - days` has just passed. The
 * `reminders` table records what has been sent so nothing is sent twice.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = Date.now();

  const { data: profilesData } = await admin
    .from("profiles")
    .select("*")
    .or("email_reminders.eq.true,push_reminders.eq.true");
  const profiles = (profilesData as Profile[]) ?? [];

  let sentPush = 0;
  let sentEmail = 0;

  for (const p of profiles) {
    const days = (p.reminder_days ?? []).filter((d) => Number.isInteger(d) && d >= 0);
    if (!days.length) continue;
    const maxDays = Math.max(...days);

    const { data: coursesData } = await admin.from("courses").select("*").eq("user_id", p.id).eq("archived", false);
    const courses = (coursesData as Course[]) ?? [];
    if (!courses.length) continue;
    const courseById = new Map(courses.map((c) => [c.id, c]));

    // Anything due between now and (maxDays + 1) days from now could need a reminder.
    const { data: aData } = await admin
      .from("assignments")
      .select("*")
      .eq("user_id", p.id)
      .eq("completed", false)
      .in(
        "course_id",
        courses.map((c) => c.id),
      )
      .gte("due_at", new Date(now - WINDOW_MS).toISOString())
      .lte("due_at", new Date(now + (maxDays + 1) * DAY_MS).toISOString());
    const assignments = (aData as Assignment[]) ?? [];
    if (!assignments.length) continue;

    const { data: sentData } = await admin
      .from("reminders")
      .select("assignment_id, days_before, channel")
      .eq("user_id", p.id)
      .in(
        "assignment_id",
        assignments.map((a) => a.id),
      );
    const already = new Set((sentData ?? []).map((r) => `${r.assignment_id}:${r.days_before}:${r.channel}`));

    for (const a of assignments) {
      if (!a.due_at) continue;
      const course = courseById.get(a.course_id);
      if (!course) continue;
      const dueMs = new Date(a.due_at).getTime();

      for (const d of days) {
        const remindAt = dueMs - d * DAY_MS;
        if (remindAt > now || now - remindAt > WINDOW_MS) continue; // not yet / too old

        const courseLabel = course.code ?? course.name;
        const dueLabel = formatInTimeZone(a.due_at, p.timezone, a.all_day ? "EEE, MMM d" : "EEE, MMM d 'at' h:mm a");
        const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
        const rows: { assignment_id: string; user_id: string; days_before: number; channel: string; remind_at: string; sent: boolean; sent_at: string }[] = [];

        if (p.push_reminders && !already.has(`${a.id}:${d}:push`)) {
          const n = await sendPushToUser(p.id, {
            title: `${a.title} — due ${when}`,
            body: `${courseLabel} · ${ASSIGNMENT_TYPE_LABELS[a.type]} · ${dueLabel}`,
            url: `${getSiteUrl()}/courses/${course.id}`,
            tag: `due-${a.id}-${d}`,
          });
          sentPush += n;
          rows.push({ assignment_id: a.id, user_id: p.id, days_before: d, channel: "push", remind_at: new Date(remindAt).toISOString(), sent: true, sent_at: new Date().toISOString() });
        }

        if (p.email_reminders && p.email && !already.has(`${a.id}:${d}:email`)) {
          const { subject, html, text } = reminderEmail(
            { title: a.title, courseLabel, dueLabel, courseId: course.id, type: ASSIGNMENT_TYPE_LABELS[a.type] },
            d,
          );
          const ok = await sendEmail(p.email, subject, html, text);
          if (ok) sentEmail += 1;
          rows.push({ assignment_id: a.id, user_id: p.id, days_before: d, channel: "email", remind_at: new Date(remindAt).toISOString(), sent: ok, sent_at: new Date().toISOString() });
        }

        if (rows.length) {
          await admin.from("reminders").upsert(rows, { onConflict: "assignment_id,days_before,channel" });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, users: profiles.length, sentPush, sentEmail });
}
