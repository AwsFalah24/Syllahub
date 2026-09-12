import "server-only";
import { Resend } from "resend";
import { getSiteUrl } from "@/lib/utils";

let client: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

const FROM = process.env.EMAIL_FROM ?? "SyllaHub <reminders@syllahub.app>";

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping", { to, subject });
    return false;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
  if (error) {
    console.error("[email] failed", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Templates — plain, brand-consistent HTML. Kept dependency-free.
// ---------------------------------------------------------------------------

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function shell(title: string, body: string, cta?: { label: string; href: string }) {
  const site = getSiteUrl();
  return `<!doctype html><html><body style="margin:0;background:#f7f7fa;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#12121a;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="font-weight:600;font-size:15px;color:#12121a;margin-bottom:24px;">
    <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#7a4dff;vertical-align:middle;margin-right:8px;"></span>SyllaHub
  </div>
  <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 1px 2px rgba(18,18,26,.04),0 4px 16px rgba(18,18,26,.05);">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-.01em;">${title}</h1>
    ${body}
    ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#7a4dff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:12px;">${esc(cta.label)}</a>` : ""}
  </div>
  <p style="margin:20px 0 0;font-size:12px;color:#9c9cae;">You're getting this because reminders are on in your SyllaHub settings. <a href="${site}/settings" style="color:#6a3aef;">Manage reminders</a></p>
</div></body></html>`;
}

export interface ReminderItem {
  title: string;
  courseLabel: string;
  dueLabel: string;
  courseId: string;
  type: string;
}

export function reminderEmail(item: ReminderItem, daysBefore: number) {
  const site = getSiteUrl();
  const when = daysBefore === 0 ? "today" : daysBefore === 1 ? "tomorrow" : `in ${daysBefore} days`;
  const subject = `${item.title} is due ${when} · ${item.courseLabel}`;
  const html = shell(
    `${esc(item.title)} is due ${when}`,
    `<p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f4f;">
      <strong>${esc(item.courseLabel)}</strong> · ${esc(item.type)}<br/>
      Due ${esc(item.dueLabel)}
    </p>`,
    { label: "Open course", href: `${site}/courses/${item.courseId}` },
  );
  const text = `${item.title} is due ${when}\n${item.courseLabel} · ${item.type}\nDue ${item.dueLabel}\n\n${site}/courses/${item.courseId}`;
  return { subject, html, text };
}

export function digestEmail(name: string | null, items: ReminderItem[], periodLabel: string) {
  const site = getSiteUrl();
  const first = name?.split(" ")[0];
  const subject = items.length
    ? `${items.length} ${items.length === 1 ? "thing" : "things"} due ${periodLabel}`
    : `Nothing due ${periodLabel} — nice`;

  const list = items.length
    ? `<ul style="margin:16px 0 0;padding:0;list-style:none;">${items
        .map(
          (i) => `<li style="padding:10px 0;border-top:1px solid #e6e6ee;font-size:14px;line-height:1.5;">
            <div style="font-weight:600;color:#12121a;">${esc(i.title)}</div>
            <div style="color:#6e6e80;">${esc(i.courseLabel)} · ${esc(i.type)} · ${esc(i.dueLabel)}</div>
          </li>`,
        )
        .join("")}</ul>`
    : `<p style="margin:0;font-size:15px;color:#3f3f4f;">Your calendar is clear ${esc(periodLabel)}. A good time to get ahead.</p>`;

  const html = shell(`${first ? `${esc(first)}, here's` : "Here's"} what's due ${esc(periodLabel)}`, list, {
    label: "Open timeline",
    href: `${site}/dashboard`,
  });
  const text = [`What's due ${periodLabel}:`, ...items.map((i) => `- ${i.title} — ${i.courseLabel} · ${i.dueLabel}`), "", `${site}/dashboard`].join("\n");
  return { subject, html, text };
}
