"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpDown, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCourseFromReview } from "@/actions/courses";
import { COURSE_COLORS, COURSE_COLOR_KEYS, courseColor } from "@/lib/colors";
import { DAY_SHORT } from "@/lib/dates";
import { newKey, type DraftAssignment, type DraftGrading, type DraftMeeting, type DraftNote, type ReviewDraft } from "@/lib/review";
import { ASSIGNMENT_TYPE_LABELS, MEETING_KIND_LABELS, NOTE_TYPE_LABELS } from "@/lib/types";
import { cn, round } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const rowMotion = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: "hidden" as const },
  transition: { duration: 0.18 },
};

export function ReviewEditor({ initial, warnings }: { initial: ReviewDraft; warnings: string[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReviewDraft>(initial);
  const [pending, start] = useTransition();
  const color = courseColor(draft.course.color);

  const weightTotal = useMemo(() => round(draft.grading.reduce((s, g) => s + (g.weight_percent || 0), 0), 1), [draft.grading]);

  function update<K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (!draft.course.name.trim()) {
      toast.error("Give the course a name first.");
      return;
    }
    start(async () => {
      const res = await createCourseFromReview({
        ...draft,
        grading: draft.grading.filter((g) => g.name.trim()),
        assignments: draft.assignments.filter((a) => a.title.trim()),
        notes: draft.notes.filter((n) => n.content.trim()),
      });
      if (!res.ok) {
        if (res.code === "course_limit") {
          router.push("/upgrade?reason=course_limit");
          return;
        }
        toast.error(res.error);
        return;
      }
      toast.success("Course saved");
      router.push(`/courses/${res.data.courseId}`);
    });
  }

  return (
    <div className="pb-6">
      {warnings.length ? (
        <div className="mb-8 flex gap-3 rounded-2xl bg-warning-soft px-4 py-3.5 text-caption text-[#8a5a00]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Worth a second look</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Course header */}
      <section className="mb-12">
        <div className="flex items-start gap-3">
          <ColorPicker value={draft.course.color} onChange={(c) => update("course", { ...draft.course, color: c })} />
          <div className="min-w-0 flex-1">
            <input
              value={draft.course.name}
              onChange={(e) => update("course", { ...draft.course, name: e.target.value })}
              placeholder="Course name"
              className="inline-field -ml-2 w-full text-h2 font-semibold sm:text-h1"
              aria-label="Course name"
            />
            <div className="-ml-2 mt-1 grid grid-cols-2 gap-x-2 gap-y-1 sm:flex sm:flex-wrap sm:items-center">
              <Field
                value={draft.course.code ?? ""}
                onChange={(v) => update("course", { ...draft.course, code: v || null })}
                placeholder="Course code"
                className="sm:w-32"
              />
              <Field
                value={draft.course.professor ?? ""}
                onChange={(v) => update("course", { ...draft.course, professor: v || null })}
                placeholder="Professor"
                className="sm:w-44"
              />
              <Field
                value={draft.course.term ?? ""}
                onChange={(v) => update("course", { ...draft.course, term: v || null })}
                placeholder="Term (e.g. Fall 2026)"
                className="sm:w-40"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LabeledInline label="Term starts">
            <input
              type="date"
              value={draft.course.term_start ?? ""}
              onChange={(e) => update("course", { ...draft.course, term_start: e.target.value || null })}
              className="inline-field -ml-2 tabular"
            />
          </LabeledInline>
          <LabeledInline label="Term ends">
            <input
              type="date"
              value={draft.course.term_end ?? ""}
              onChange={(e) => update("course", { ...draft.course, term_end: e.target.value || null })}
              className="inline-field -ml-2 tabular"
            />
          </LabeledInline>
          <LabeledInline label="Target grade">
            <div className="-ml-2 flex items-center">
              <input
                type="number"
                min={0}
                max={100}
                value={draft.course.target_grade}
                onChange={(e) => update("course", { ...draft.course, target_grade: Number(e.target.value) })}
                className="inline-field w-20 tabular"
              />
              <span className="text-ink-muted">%</span>
            </div>
          </LabeledInline>
        </div>
      </section>

      {/* Grading breakdown */}
      <Section
        title="Grading breakdown"
        aside={
          <span
            className={cn(
              "tabular font-medium",
              Math.abs(weightTotal - 100) < 0.01 ? "text-success" : weightTotal > 100 ? "text-danger" : "text-warning",
            )}
          >
            {weightTotal}% of 100%
          </span>
        }
        onAdd={() => update("grading", [...draft.grading, { key: newKey(), name: "", weight_percent: 0 }])}
        addLabel="Add component"
      >
        {draft.grading.length === 0 ? (
          <EmptyRow>No grading components found. Add one, e.g. “Midterm — 25%”.</EmptyRow>
        ) : null}
        <AnimatePresence initial={false}>
          {draft.grading.map((g) => (
            <motion.div key={g.key} {...rowMotion} className="group flex items-center gap-2 py-0.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
              <input
                value={g.name}
                onChange={(e) => update("grading", patch(draft.grading, g.key, { name: e.target.value }))}
                placeholder="Component name"
                className="inline-field flex-1 font-medium"
              />
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={g.weight_percent}
                  onChange={(e) => update("grading", patch(draft.grading, g.key, { weight_percent: Number(e.target.value) }))}
                  className="inline-field w-16 text-right tabular"
                />
                <span className="pr-1 text-ink-muted">%</span>
              </div>
              <DeleteButton onClick={() => update("grading", draft.grading.filter((x) => x.key !== g.key))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </Section>

      {/* Deadlines */}
      <Section
        title="Deadlines & exams"
        aside={
          <button
            type="button"
            onClick={() =>
              update(
                "assignments",
                [...draft.assignments].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
              )
            }
            className="inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
          >
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort by date
          </button>
        }
        onAdd={() =>
          update("assignments", [
            ...draft.assignments,
            {
              key: newKey(),
              title: "",
              type: "assignment",
              due_date: null,
              due_time: null,
              componentKey: null,
              weight_percent: null,
              description: null,
            },
          ])
        }
        addLabel="Add deadline"
      >
        {draft.assignments.length === 0 ? <EmptyRow>No deadlines found. Add the first one.</EmptyRow> : null}
        <div className="hidden grid-cols-[110px_1fr_150px_100px_160px_36px] gap-2 px-1 pb-1 text-micro font-semibold uppercase tracking-wider text-ink-subtle md:grid">
          <span>Type</span>
          <span>Title</span>
          <span>Date</span>
          <span>Time</span>
          <span>Counts toward</span>
          <span />
        </div>
        <AnimatePresence initial={false}>
          {draft.assignments.map((a) => (
            <AssignmentRow
              key={a.key}
              a={a}
              grading={draft.grading}
              onChange={(p) => update("assignments", patch(draft.assignments, a.key, p))}
              onDelete={() => update("assignments", draft.assignments.filter((x) => x.key !== a.key))}
            />
          ))}
        </AnimatePresence>
      </Section>

      {/* Class schedule */}
      <Section
        title="Class schedule"
        onAdd={() =>
          update("meetings", [
            ...draft.meetings,
            { key: newKey(), day_of_week: 1, start_time: "10:00", end_time: "11:00", location: null, kind: "lecture" },
          ])
        }
        addLabel="Add class time"
      >
        {draft.meetings.length === 0 ? (
          <EmptyRow>No class times found. Add them so your weekly plan works around lectures.</EmptyRow>
        ) : null}
        <AnimatePresence initial={false}>
          {draft.meetings.map((m) => (
            <motion.div key={m.key} {...rowMotion} className="group flex flex-wrap items-center gap-2 py-0.5">
              <select
                value={m.kind}
                onChange={(e) => update("meetings", patch(draft.meetings, m.key, { kind: e.target.value as DraftMeeting["kind"] }))}
                className="inline-field w-28 text-caption font-medium"
              >
                {Object.entries(MEETING_KIND_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={m.day_of_week}
                onChange={(e) => update("meetings", patch(draft.meetings, m.key, { day_of_week: Number(e.target.value) }))}
                className="inline-field w-20"
              >
                {DAY_SHORT.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={m.start_time}
                onChange={(e) => update("meetings", patch(draft.meetings, m.key, { start_time: e.target.value }))}
                className="inline-field w-28 tabular"
              />
              <span className="text-ink-subtle">–</span>
              <input
                type="time"
                value={m.end_time}
                onChange={(e) => update("meetings", patch(draft.meetings, m.key, { end_time: e.target.value }))}
                className="inline-field w-28 tabular"
              />
              <input
                value={m.location ?? ""}
                onChange={(e) => update("meetings", patch(draft.meetings, m.key, { location: e.target.value || null }))}
                placeholder="Room / building"
                className="inline-field min-w-32 flex-1"
              />
              <DeleteButton onClick={() => update("meetings", draft.meetings.filter((x) => x.key !== m.key))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </Section>

      {/* Notes */}
      <Section
        title="Policies & professor instructions"
        onAdd={() => update("notes", [...draft.notes, { key: newKey(), type: "instruction", content: "" }])}
        addLabel="Add note"
      >
        {draft.notes.length === 0 ? (
          <EmptyRow>Nothing captured. Add late policies, office hours, or rules like “no laptops”.</EmptyRow>
        ) : null}
        <AnimatePresence initial={false}>
          {draft.notes.map((n) => (
            <motion.div key={n.key} {...rowMotion} className="group flex items-start gap-2 py-1">
              <select
                value={n.type}
                onChange={(e) => update("notes", patch(draft.notes, n.key, { type: e.target.value as DraftNote["type"] }))}
                className="inline-field mt-0.5 w-32 shrink-0 text-caption font-medium"
              >
                {Object.entries(NOTE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <AutoTextarea
                value={n.content}
                onChange={(v) => update("notes", patch(draft.notes, n.key, { content: v }))}
                placeholder="What did the professor say?"
              />
              <DeleteButton onClick={() => update("notes", draft.notes.filter((x) => x.key !== n.key))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-[76px] z-30 md:bottom-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-bg/95 px-4 py-3 shadow-lift backdrop-blur-md">
          <div className="hidden text-caption text-ink-muted sm:block">
            <span className="font-medium text-ink">{draft.assignments.length}</span> deadlines ·{" "}
            <span className="font-medium text-ink">{draft.grading.length}</span> components ·{" "}
            <span className="font-medium text-ink">{draft.notes.length}</span> notes
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push("/courses/new")} disabled={pending}>
              Start over
            </Button>
            <Button onClick={save} loading={pending} className="min-w-36">
              {!pending && <Check className="h-4 w-4" />}
              Save course
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows & bits
// ---------------------------------------------------------------------------

function AssignmentRow({
  a,
  grading,
  onChange,
  onDelete,
}: {
  a: DraftAssignment;
  grading: DraftGrading[];
  onChange: (p: Partial<DraftAssignment>) => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      {...rowMotion}
      className="group grid grid-cols-2 gap-x-2 gap-y-1 rounded-xl py-2 md:grid-cols-[110px_1fr_150px_100px_160px_36px] md:items-center md:py-0.5"
    >
      <select
        value={a.type}
        onChange={(e) => onChange({ type: e.target.value as DraftAssignment["type"] })}
        className="inline-field text-caption font-medium"
      >
        {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input
        value={a.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Title"
        className="inline-field col-span-2 font-medium md:col-span-1"
      />
      <input
        type="date"
        value={a.due_date ?? ""}
        onChange={(e) => onChange({ due_date: e.target.value || null })}
        className={cn("inline-field tabular", !a.due_date && "text-ink-subtle")}
      />
      <input
        type="time"
        value={a.due_time ?? ""}
        onChange={(e) => onChange({ due_time: e.target.value || null })}
        className={cn("inline-field tabular", !a.due_time && "text-ink-subtle")}
      />
      <select
        value={a.componentKey ?? ""}
        onChange={(e) => onChange({ componentKey: e.target.value || null })}
        className={cn("inline-field text-caption", !a.componentKey && "text-ink-subtle")}
      >
        <option value="">— no component —</option>
        {grading.map((g) => (
          <option key={g.key} value={g.key}>
            {g.name || "Untitled"}
          </option>
        ))}
      </select>
      <div className="flex justify-end">
        <DeleteButton onClick={onDelete} />
      </div>
    </motion.div>
  );
}

function Section({
  title,
  aside,
  children,
  onAdd,
  addLabel,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <section className="mb-12">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      <div className="-mx-1">{children}</div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-caption font-medium text-brand-600 transition hover:bg-brand-50"
      >
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-3 text-caption text-ink-subtle">{children}</p>;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-danger-soft hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("inline-field text-caption text-ink-muted", className)}
    />
  );
}

function LabeledInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      {children}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      {/* Mirror element sizes the textarea to its content. */}
      <div aria-hidden className="invisible whitespace-pre-wrap break-words px-2 py-1.5 text-body">
        {value || placeholder}
        {"\u200b"}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className="inline-field absolute inset-0 resize-none overflow-hidden"
      />
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const c = courseColor(value);
  return (
    <div className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Course color"
        className="h-9 w-9 rounded-xl ring-4 ring-transparent transition hover:ring-surface-2"
        style={{ backgroundColor: c.hex }}
      />
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 z-20 grid grid-cols-5 gap-1.5 rounded-xl bg-bg p-2 shadow-lift">
            {COURSE_COLOR_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-label={COURSE_COLORS[k].name}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn("h-7 w-7 rounded-lg transition hover:scale-110", k === value && "ring-2 ring-ink ring-offset-2")}
                style={{ backgroundColor: COURSE_COLORS[k].hex }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function patch<T extends { key: string }>(list: T[], key: string, p: Partial<T>): T[] {
  return list.map((x) => (x.key === key ? { ...x, ...p } : x));
}
