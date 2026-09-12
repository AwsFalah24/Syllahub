"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addCourseMeeting, deleteCourseMeeting } from "@/actions/courses";
import { DAY_NAMES, DAY_SHORT, formatTimeStr } from "@/lib/dates";
import { MEETING_KIND_LABELS, type CourseMeeting, type MeetingKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SectionTitle } from "@/components/shell/page-header";

export function MeetingsSection({ courseId, meetings: initial }: { courseId: string; meetings: CourseMeeting[] }) {
  const [meetings, setMeetings] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ day_of_week: 1, start_time: "10:00", end_time: "11:00", location: "", kind: "lecture" as MeetingKind });

  function add() {
    start(async () => {
      const res = await addCourseMeeting(courseId, { ...form, location: form.location || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMeetings((m) =>
        [...m, { id: `tmp-${Date.now()}`, course_id: courseId, user_id: "", ...form, location: form.location || null, created_at: "" }].sort(
          (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
        ),
      );
      setAdding(false);
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteCourseMeeting(id, courseId);
      if (!res.ok) toast.error(res.error);
      else setMeetings((m) => m.filter((x) => x.id !== id));
    });
  }

  return (
    <section>
      <SectionTitle
        aside={
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" /> Add time
          </button>
        }
      >
        Class schedule
      </SectionTitle>

      {meetings.length === 0 && !adding ? (
        <p className="text-caption text-ink-muted">No class times yet — add them so the weekly plan can work around lectures.</p>
      ) : null}

      <ul className="space-y-1">
        {meetings.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface">
            <span className="w-10 shrink-0 text-caption font-semibold text-ink">{DAY_SHORT[m.day_of_week]}</span>
            <span className="text-body text-ink-2 tabular">
              {formatTimeStr(m.start_time)} – {formatTimeStr(m.end_time)}
            </span>
            <span className="rounded-md bg-surface-2 px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-ink-muted">
              {MEETING_KIND_LABELS[m.kind]}
            </span>
            {m.location ? (
              <span className="hidden items-center gap-1 text-caption text-ink-muted sm:inline-flex">
                <MapPin className="h-3 w-3" /> {m.location}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => remove(m.id)}
              className="ml-auto rounded-md p-1 text-ink-subtle hover:bg-danger-soft hover:text-danger md:opacity-0 md:transition md:group-hover:opacity-100"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-5">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as MeetingKind })} className="h-10 bg-bg">
            {Object.entries(MEETING_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="h-10 bg-bg">
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
          <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="h-10" />
          <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="h-10" />
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room" className="h-10" />
          <div className="col-span-2 flex justify-end gap-2 sm:col-span-5">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} loading={pending}>
              Add
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
