import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushSubscriptionRow } from "@/lib/types";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@syllahub.app", pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send to every subscription a user has; prune the ones that are gone. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const admin = createAdminClient();
  const { data } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  const subs = (data as PushSubscriptionRow[]) ?? [];
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("[push] send failed", status, err);
      }
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return sent;
}
