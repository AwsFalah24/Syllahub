"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { rotateIcsToken, updateProfileSettings } from "@/actions/profile";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const TIMEZONES = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
})();

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    school: profile.school ?? "",
    timezone: profile.timezone,
    study_hours_per_day: Number(profile.study_hours_per_day),
    study_start_hour: profile.study_start_hour,
    study_end_hour: profile.study_end_hour,
  });

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfileSettings({ ...form, school: form.school || null });
      if (res?.error) toast.error(res.error);
      else toast.success("Saved");
    });
  }

  const tzList = TIMEZONES.length ? TIMEZONES : [profile.timezone];

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-name">Name</Label>
          <Input id="s-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="s-school">School</Label>
          <Input id="s-school" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="s-tz">Timezone</Label>
          <Select id="s-tz" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {tzList.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div id="planner">
        <h3 className="text-caption font-semibold text-ink">Study planner</h3>
        <p className="mb-3 text-caption text-ink-muted">How much time to schedule, and when you&apos;re willing to study.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="s-hours">Hours / day</Label>
            <Input
              id="s-hours"
              type="number"
              min={0.5}
              max={16}
              step="0.5"
              value={form.study_hours_per_day}
              onChange={(e) => setForm({ ...form, study_hours_per_day: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="s-start">Earliest</Label>
            <Select id="s-start" value={form.study_start_hour} onChange={(e) => setForm({ ...form, study_start_hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="s-end">Latest</Label>
            <Select id="s-end" value={form.study_end_hour} onChange={(e) => setForm({ ...form, study_end_hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function hourLabel(h: number) {
  if (h === 24) return "Midnight";
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}

export function CalendarFeed({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2.5 text-caption text-ink-2">{url}</code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
        <a
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https?:/, "webcal:"))}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Add to Google Calendar
        </a>
        <a href={url.replace(/^https?:/, "webcal:")} className="font-medium text-brand-600 hover:text-brand-700">
          Add to Apple Calendar
        </a>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 hover:text-ink"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await rotateIcsToken();
              if (res?.error) toast.error(res.error);
              else toast.success("New link generated. Old link no longer works.");
            })
          }
        >
          <RefreshCw className="h-3 w-3" /> Reset link
        </button>
      </div>
    </div>
  );
}

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not open billing");
      window.location.assign(json.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing");
      setLoading(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={open} loading={loading}>
      Manage subscription
    </Button>
  );
}
