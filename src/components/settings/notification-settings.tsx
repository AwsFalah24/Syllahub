"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { updateNotificationSettings } from "@/actions/profile";
import type { DigestFrequency, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/input";

const DAY_OPTIONS = [7, 5, 3, 2, 1, 0];

type PushState = "unsupported" | "unknown" | "subscribed" | "unsubscribed" | "denied";

async function detectPushState(vapid: string | undefined): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !vapid) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "unsubscribed";
  } catch {
    return "unsupported";
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationSettings({ profile }: { profile: Profile }) {
  const [days, setDays] = useState<number[]>(profile.reminder_days ?? [3, 1]);
  const [email, setEmail] = useState(profile.email_reminders);
  const [push, setPush] = useState(profile.push_reminders);
  const [digest, setDigest] = useState<DigestFrequency>(profile.digest);
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [, start] = useTransition();

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    detectPushState(vapid).then((state) => {
      if (!cancelled) setPushState(state);
    });
    return () => {
      cancelled = true;
    };
  }, [vapid]);

  function persist(next: Partial<{ reminder_days: number[]; email_reminders: boolean; push_reminders: boolean; digest: DigestFrequency }>) {
    start(async () => {
      const res = await updateNotificationSettings({
        reminder_days: next.reminder_days ?? days,
        email_reminders: next.email_reminders ?? email,
        push_reminders: next.push_reminders ?? push,
        digest: next.digest ?? digest,
      });
      if (res?.error) toast.error(res.error);
    });
  }

  async function enablePushOnThisDevice() {
    if (!vapid) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        toast.error("Notifications are blocked for this site.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Could not save subscription");
      setPushState("subscribed");
      if (!push) {
        setPush(true);
        persist({ push_reminders: true });
      }
      toast.success("Push reminders enabled on this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable push");
    }
  }

  async function disablePushOnThisDevice() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setPushState("unsubscribed");
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 text-caption font-semibold text-ink">Remind me before a deadline</div>
        <div className="flex flex-wrap gap-1.5">
          {DAY_OPTIONS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const next = on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => b - a);
                  setDays(next);
                  persist({ reminder_days: next });
                }}
                className={cn(
                  "h-8 rounded-full px-3 text-caption font-medium transition-all",
                  on ? "bg-brand-500 text-white shadow-brand/40" : "bg-surface-2 text-ink-2 hover:bg-surface-3",
                )}
              >
                {d === 0 ? "Day of" : `${d} day${d === 1 ? "" : "s"} before`}
              </button>
            );
          })}
        </div>
      </div>

      <Row title="Email reminders" description={`Sent to ${profile.email ?? "your email"}.`}>
        <Switch
          checked={email}
          onCheckedChange={(v) => {
            setEmail(v);
            persist({ email_reminders: v });
          }}
        />
      </Row>

      <Row
        title="Push notifications"
        description={
          pushState === "unsupported"
            ? "Not available in this browser. On iPhone, add SyllaHub to your Home Screen first."
            : pushState === "denied"
              ? "Blocked in your browser settings for this site."
              : pushState === "subscribed"
                ? "This device is subscribed."
                : "Turn on to get a nudge on this device."
        }
      >
        <div className="flex items-center gap-3">
          {pushState === "subscribed" ? (
            <button type="button" onClick={disablePushOnThisDevice} className="text-caption text-ink-muted hover:text-ink">
              Remove this device
            </button>
          ) : pushState === "unsubscribed" ? (
            <button type="button" onClick={enablePushOnThisDevice} className="inline-flex items-center gap-1 text-caption font-semibold text-brand-600 hover:text-brand-700">
              <BellRing className="h-3.5 w-3.5" /> Enable on this device
            </button>
          ) : null}
          <Switch
            checked={push}
            disabled={pushState === "unsupported"}
            onCheckedChange={(v) => {
              setPush(v);
              persist({ push_reminders: v });
              if (v && pushState === "unsubscribed") enablePushOnThisDevice();
            }}
          />
        </div>
      </Row>

      <Row title="Digest email" description="A summary of what's due, delivered at 7am.">
        <Select
          value={digest}
          onChange={(e) => {
            const v = e.target.value as DigestFrequency;
            setDigest(v);
            persist({ digest: v });
          }}
          className="h-9 w-40 text-caption"
        >
          <option value="none">Off</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly (Monday)</option>
        </Select>
      </Row>
    </div>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="text-caption font-semibold text-ink">{title}</div>
        <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
