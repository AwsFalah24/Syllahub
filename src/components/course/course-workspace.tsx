"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createComponent,
  deleteAssignment,
  deleteComponent,
  setAssignmentGrade,
  toggleAssignmentComplete,
  updateComponent,
} from "@/actions/assignments";
import { updateCourse } from "@/actions/courses";
import { courseColor } from "@/lib/colors";
import type { CourseBundle } from "@/lib/data";
import { localDate, relativeDue } from "@/lib/dates";
import { computeStanding, percentOf } from "@/lib/grades";
import { ASSIGNMENT_TYPE_LABELS, type Assignment, type Course, type GradingComponent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/shell/page-header";
import { GradeHero } from "@/components/grades/grade-hero";
import { AssignmentDialog } from "./assignment-dialog";
import { CourseMenu } from "./course-menu";
import { GradeInput } from "./grade-input";
import { MeetingsSection } from "./meetings-section";
import { NotesSection } from "./notes-section";

export function CourseWorkspace({ bundle, timezone }: { bundle: CourseBundle; timezone: string }) {
  const [course, setCourse] = useState<Course>(bundle.course);
  const [components, setComponents] = useState<GradingComponent[]>(bundle.components);
  const [assignments, setAssignments] = useState<Assignment[]>(bundle.assignments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [, start] = useTransition();
  const targetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const color = courseColor(course.color);
  const standing = useMemo(() => computeStanding(components, assignments), [components, assignments]);
  const now = useMemo(() => new Date(), []);

  const weightTotal = components.reduce((s, c) => s + Number(c.weight_percent || 0), 0);

  // --- Target grade (debounced save) ---
  function changeTarget(t: number) {
    const clamped = Math.max(0, Math.min(100, t || 0));
    setCourse((c) => ({ ...c, target_grade: clamped }));
    if (targetTimer.current) clearTimeout(targetTimer.current);
    targetTimer.current = setTimeout(() => {
      start(async () => {
        const res = await updateCourse(course.id, { target_grade: clamped });
        if (!res.ok) toast.error(res.error);
      });
    }, 500);
  }

  // --- Assignments ---
  function commitGrade(a: Assignment, score: number | null, max: number) {
    setAssignments((list) =>
      list.map((x) => (x.id === a.id ? { ...x, score, max_score: max, completed: score != null ? true : x.completed } : x)),
    );
    start(async () => {
      const res = await setAssignmentGrade(a.id, { score, max_score: max });
      if (!res.ok) toast.error(res.error);
    });
  }

  function toggleDone(a: Assignment) {
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, completed: !a.completed } : x)));
    start(async () => {
      const res = await toggleAssignmentComplete(a.id, !a.completed);
      if (!res.ok) toast.error(res.error);
    });
  }

  function removeAssignment(a: Assignment) {
    setAssignments((list) => list.filter((x) => x.id !== a.id));
    start(async () => {
      const res = await deleteAssignment(a.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onSaved(a: Assignment) {
    setAssignments((list) => {
      const exists = list.some((x) => x.id === a.id);
      const next = exists ? list.map((x) => (x.id === a.id ? { ...x, ...a } : x)) : [...list, a];
      return next.sort((x, y) => (x.due_at ?? "9999").localeCompare(y.due_at ?? "9999"));
    });
  }

  // --- Components ---
  function patchComponent(id: string, p: Partial<GradingComponent>) {
    setComponents((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
    start(async () => {
      const res = await updateComponent(id, course.id, {
        ...(p.name != null ? { name: p.name } : {}),
        ...(p.weight_percent != null ? { weight_percent: Number(p.weight_percent) } : {}),
        ...("grade_override" in p ? { grade_override: p.grade_override ?? null } : {}),
      });
      if (!res.ok) toast.error(res.error);
    });
  }

  function addComponent() {
    const name = "New component";
    start(async () => {
      const res = await createComponent(course.id, { name, weight_percent: 0 });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setComponents((list) => [
        ...list,
        { id: res.data.id, course_id: course.id, user_id: "", name, weight_percent: 0, grade_override: null, position: list.length, created_at: "" },
      ]);
    });
  }

  function removeComponent(c: GradingComponent) {
    setComponents((list) => list.filter((x) => x.id !== c.id));
    setAssignments((list) => list.map((a) => (a.component_id === c.id ? { ...a, component_id: null } : a)));
    start(async () => {
      const res = await deleteComponent(c.id, course.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  const upcoming = assignments.filter((a) => !a.completed);
  const done = assignments.filter((a) => a.completed);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/courses" className="mb-4 inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Courses
        </Link>
        <div className="flex items-start gap-4">
          <span className="mt-1.5 h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
              {course.code ? <span className="font-semibold" style={{ color: color.text }}>{course.code}</span> : null}
              {course.term ? <span>· {course.term}</span> : null}
              {course.archived ? <span className="rounded-md bg-surface-2 px-1.5 py-px text-micro font-semibold uppercase">Archived</span> : null}
            </div>
            <h1 className="mt-0.5 text-h1 font-semibold text-ink">{course.name}</h1>
            {course.professor ? <p className="mt-1 text-body text-ink-muted">{course.professor}</p> : null}
          </div>
          <CourseMenu course={course} onUpdated={(p) => setCourse((c) => ({ ...c, ...p }))} />
        </div>
      </div>

      <GradeHero standing={standing} target={course.target_grade} onTargetChange={changeTarget} colorHex={color.hex} />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_300px] lg:gap-14">
        <div className="space-y-12">
          {/* Work list */}
          <section>
            <SectionTitle
              aside={
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add work
                </button>
              }
            >
              Deadlines & grades
            </SectionTitle>

            {assignments.length === 0 ? (
              <p className="text-caption text-ink-muted">Nothing here yet. Add assignments, quizzes and exams as they come up.</p>
            ) : null}

            <ul className="-mx-2">
              <AnimatePresence initial={false}>
                {upcoming.map((a) => (
                  <WorkRow
                    key={a.id}
                    a={a}
                    component={components.find((c) => c.id === a.component_id)}
                    now={now}
                    timezone={timezone}
                    colorHex={color.hex}
                    onToggle={() => toggleDone(a)}
                    onGrade={(s, m) => commitGrade(a, s, m)}
                    onEdit={() => {
                      setEditing(a);
                      setDialogOpen(true);
                    }}
                    onDelete={() => removeAssignment(a)}
                  />
                ))}
              </AnimatePresence>
            </ul>

            {done.length ? (
              <details className="mt-4 group" open={upcoming.length === 0}>
                <summary className="cursor-pointer select-none px-2 text-caption font-semibold text-ink-muted hover:text-ink">
                  Completed · {done.length}
                </summary>
                <ul className="-mx-2 mt-1">
                  <AnimatePresence initial={false}>
                    {done.map((a) => (
                      <WorkRow
                        key={a.id}
                        a={a}
                        component={components.find((c) => c.id === a.component_id)}
                        now={now}
                        timezone={timezone}
                        colorHex={color.hex}
                        onToggle={() => toggleDone(a)}
                        onGrade={(s, m) => commitGrade(a, s, m)}
                        onEdit={() => {
                          setEditing(a);
                          setDialogOpen(true);
                        }}
                        onDelete={() => removeAssignment(a)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </details>
            ) : null}
          </section>

          <NotesSection courseId={course.id} notes={bundle.notes} />
        </div>

        <aside className="space-y-12">
          {/* Breakdown */}
          <section>
            <SectionTitle
              aside={
                <span className={cn("tabular", Math.abs(weightTotal - 100) < 0.01 ? "text-success" : "text-warning")}>
                  {weightTotal.toFixed(0)}%
                </span>
              }
            >
              Grading breakdown
            </SectionTitle>
            <ul className="space-y-3">
              {standing.components
                .filter((s) => !s.id.startsWith("a:"))
                .map((s) => {
                  const c = components.find((x) => x.id === s.id)!;
                  return (
                    <ComponentRow
                      key={s.id}
                      c={c}
                      average={s.average}
                      graded={s.gradedCount}
                      total={s.totalCount}
                      colorHex={color.hex}
                      onPatch={(p) => patchComponent(c.id, p)}
                      onDelete={() => removeComponent(c)}
                    />
                  );
                })}
              {standing.components
                .filter((s) => s.id.startsWith("a:"))
                .map((s) => (
                  <li key={s.id} className="px-1">
                    <div className="flex items-center justify-between text-caption">
                      <span className="truncate font-medium text-ink">{s.name}</span>
                      <span className="tabular text-ink-muted">{s.weight}%</span>
                    </div>
                    <Bar value={s.average} colorHex={color.hex} />
                  </li>
                ))}
            </ul>
            <button
              type="button"
              onClick={addComponent}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-caption font-medium text-brand-600 transition hover:text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add component
            </button>
            {standing.unweighted.length ? (
              <p className="mt-3 text-micro text-ink-subtle">
                {standing.unweighted.length} item{standing.unweighted.length === 1 ? "" : "s"} not linked to a component don&apos;t count toward
                the grade. Edit them to pick one.
              </p>
            ) : null}
          </section>

          <MeetingsSection courseId={course.id} meetings={bundle.meetings} />
        </aside>
      </div>

      <AssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        courseId={course.id}
        components={components}
        timezone={timezone}
        editing={editing}
        onSaved={onSaved}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function WorkRow({
  a,
  component,
  now,
  timezone,
  colorHex,
  onToggle,
  onGrade,
  onEdit,
  onDelete,
}: {
  a: Assignment;
  component: GradingComponent | undefined;
  now: Date;
  timezone: string;
  colorHex: string;
  onToggle: () => void;
  onGrade: (score: number | null, max: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = a.due_at ? localDate(a.due_at, timezone) : null;
  const overdue = due && !a.completed && due < now;
  const isExam = a.type === "exam" || a.type === "quiz";
  const pct = percentOf(a);

  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2 }}
      className={cn("group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface", a.completed && "opacity-70")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={a.completed ? "Mark as not done" : "Mark as done"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
          a.completed ? "border-transparent text-white" : "border-line-strong bg-bg hover:border-brand-400",
        )}
        style={a.completed ? { backgroundColor: colorHex } : undefined}
      >
        <Check className={cn("h-3 w-3 transition-transform", a.completed ? "scale-100" : "scale-0")} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1 basis-40">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-body font-medium text-ink", a.completed && pct == null && "line-through")}>{a.title}</span>
          {isExam ? (
            <span className="shrink-0 rounded-md bg-danger-soft px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-danger">
              {ASSIGNMENT_TYPE_LABELS[a.type]}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
          <span className={cn(overdue && "font-semibold text-danger")}>{due ? relativeDue(due, now, a.all_day) : "No date"}</span>
          {component ? (
            <>
              <span aria-hidden>·</span>
              <span>{component.name}</span>
            </>
          ) : a.weight_percent ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{a.weight_percent}%</span>
            </>
          ) : null}
        </div>
      </div>

      <GradeInput key={`${a.score ?? ""}/${a.max_score}`} score={a.score} maxScore={a.max_score} onCommit={onGrade} />

      <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-ink-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.li>
  );
}

function ComponentRow({
  c,
  average,
  graded,
  total,
  colorHex,
  onPatch,
  onDelete,
}: {
  c: GradingComponent;
  average: number | null;
  graded: number;
  total: number;
  colorHex: string;
  onPatch: (p: Partial<GradingComponent>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(c.name);
  const [weight, setWeight] = useState(String(c.weight_percent));
  const [override, setOverride] = useState(c.grade_override == null ? "" : String(c.grade_override));

  return (
    <li className="group px-1">
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== c.name && onPatch({ name: name.trim() })}
          className="inline-field -ml-2 min-w-0 flex-1 text-caption font-medium"
          aria-label="Component name"
        />
        <span className="flex items-center text-caption text-ink-muted">
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => {
              const w = Number(weight);
              if (!Number.isNaN(w) && w !== Number(c.weight_percent)) onPatch({ weight_percent: w });
            }}
            className="inline-field w-12 text-right tabular"
            aria-label="Weight percent"
          />
          %
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove component"
          className="rounded-md p-1 text-ink-subtle hover:bg-danger-soft hover:text-danger md:opacity-0 md:transition md:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <Bar value={average} colorHex={colorHex} />
      <div className="mt-1 flex items-center justify-between text-micro text-ink-subtle">
        {total > 0 ? (
          <span>
            {graded}/{total} graded{average != null ? ` · avg ${average.toFixed(1)}%` : ""}
          </span>
        ) : (
          <label className="flex items-center gap-1">
            Grade:
            <input
              inputMode="decimal"
              value={override}
              placeholder="—"
              onChange={(e) => setOverride(e.target.value)}
              onBlur={() => {
                const v = override.trim() === "" ? null : Number(override);
                if (v !== null && Number.isNaN(v)) return;
                if (v !== c.grade_override) onPatch({ grade_override: v });
              }}
              className="w-10 rounded-md bg-surface-2 px-1 text-right tabular text-ink outline-none focus:bg-bg focus:ring-1 focus:ring-brand-300"
              aria-label="Component grade"
            />
            %
          </label>
        )}
      </div>
    </li>
  );
}

function Bar({ value, colorHex }: { value: number | null; colorHex: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: colorHex }}
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, opacity: value == null ? 0 : 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
