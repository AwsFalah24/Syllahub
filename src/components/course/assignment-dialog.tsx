"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAssignment, updateAssignment, type AssignmentInput } from "@/actions/assignments";
import { fromDueAt } from "@/lib/dates";
import { ASSIGNMENT_TYPE_LABELS, type Assignment, type AssignmentType, type GradingComponent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export function AssignmentDialog({
  open,
  onOpenChange,
  courseId,
  components,
  timezone,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: string;
  components: GradingComponent[];
  timezone: string;
  editing: Assignment | null;
  onSaved: (a: Assignment) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? "Edit item" : "Add work"} description="Deadlines, exams, readings — anything with a date.">
        {/* Keyed so the form re-initializes for each item; content unmounts when closed. */}
        <AssignmentForm
          key={editing?.id ?? "new"}
          courseId={courseId}
          components={components}
          timezone={timezone}
          editing={editing}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function initialForm(editing: Assignment | null, timezone: string): AssignmentInput {
  if (!editing) return blank();
  const { date, time } = editing.due_at ? fromDueAt(editing.due_at, timezone, editing.all_day) : { date: null, time: null };
  return {
    title: editing.title,
    type: editing.type,
    due_date: date,
    due_time: time,
    component_id: editing.component_id,
    weight_percent: editing.weight_percent,
    estimated_hours: editing.estimated_hours,
    notes: editing.notes,
  };
}

function AssignmentForm({
  courseId,
  components,
  timezone,
  editing,
  onSaved,
  onClose,
}: {
  courseId: string;
  components: GradingComponent[];
  timezone: string;
  editing: Assignment | null;
  onSaved: (a: Assignment) => void;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<AssignmentInput>(() => initialForm(editing, timezone));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = editing ? await updateAssignment(editing.id, form) : await createAssignment(courseId, form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const id = editing ? editing.id : (res as { ok: true; data: { id: string } }).data.id;
      const dueIso = form.due_date ? new Date(`${form.due_date}T${form.due_time ?? "23:59"}:00`).toISOString() : null;
      onSaved({
        id,
        course_id: courseId,
        user_id: editing?.user_id ?? "",
        component_id: form.component_id,
        title: form.title,
        type: form.type,
        // Local approximation for optimistic UI; server value arrives on refresh.
        due_at: dueIso,
        all_day: !form.due_time,
        weight_percent: form.weight_percent,
        score: editing?.score ?? null,
        max_score: editing?.max_score ?? 100,
        completed: editing?.completed ?? false,
        estimated_hours: form.estimated_hours,
        notes: form.notes,
        created_at: editing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      onClose();
      toast.success(editing ? "Updated" : "Added");
    });
  }

  return (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              autoFocus
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Problem Set 3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-type">Type</Label>
              <Select id="a-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssignmentType })}>
                {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="a-comp">Counts toward</Label>
              <Select
                id="a-comp"
                value={form.component_id ?? ""}
                onChange={(e) => setForm({ ...form, component_id: e.target.value || null })}
              >
                <option value="">— none —</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight_percent}%)
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-date">Due date</Label>
              <Input
                id="a-date"
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="a-time">Time (optional)</Label>
              <Input
                id="a-time"
                type="time"
                value={form.due_time ?? ""}
                onChange={(e) => setForm({ ...form, due_time: e.target.value || null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-weight">Own weight % (optional)</Label>
              <Input
                id="a-weight"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.weight_percent ?? ""}
                onChange={(e) => setForm({ ...form, weight_percent: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder={form.component_id ? "Uses component" : "e.g. 25"}
                disabled={!!form.component_id}
              />
            </div>
            <div>
              <Label htmlFor="a-hours">Est. hours</Label>
              <Input
                id="a-hours"
                type="number"
                min={0}
                step="0.5"
                value={form.estimated_hours ?? ""}
                onChange={(e) => setForm({ ...form, estimated_hours: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="3"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="a-notes">Notes</Label>
            <Textarea
              id="a-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              placeholder="Chapters 4–6, submit on Gradescope…"
              className="min-h-20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? "Save changes" : "Add"}
            </Button>
          </div>
        </form>
  );
}

function blank(): AssignmentInput {
  return {
    title: "",
    type: "assignment",
    due_date: null,
    due_time: null,
    component_id: null,
    weight_percent: null,
    estimated_hours: null,
    notes: null,
  };
}
