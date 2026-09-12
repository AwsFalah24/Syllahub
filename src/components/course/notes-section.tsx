"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Mail, MessageSquareText, Pencil, Plus, ScrollText, Trash2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { addCourseNote, deleteCourseNote, updateCourseNote } from "@/actions/courses";
import { NOTE_TYPE_LABELS, type CourseNote, type NoteType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SectionTitle } from "@/components/shell/page-header";

const ICONS: Record<NoteType, React.ComponentType<{ className?: string }>> = {
  late_policy: Clock,
  attendance: UserCheck,
  instruction: MessageSquareText,
  office_hours: Clock,
  contact: Mail,
  other: ScrollText,
};

const ORDER: NoteType[] = ["instruction", "late_policy", "attendance", "office_hours", "contact", "other"];

export function NotesSection({ courseId, notes: initial }: { courseId: string; notes: CourseNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [newType, setNewType] = useState<NoteType>("instruction");
  const [newContent, setNewContent] = useState("");

  const grouped = ORDER.map((t) => ({ type: t, items: notes.filter((n) => n.type === t) })).filter((g) => g.items.length);

  function add() {
    if (!newContent.trim()) return;
    start(async () => {
      const res = await addCourseNote(courseId, { type: newType, content: newContent });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNotes((n) => [
        ...n,
        { id: `tmp-${Date.now()}`, course_id: courseId, user_id: "", type: newType, content: newContent.trim(), position: n.length, created_at: new Date().toISOString() },
      ]);
      setNewContent("");
      setAdding(false);
    });
  }

  return (
    <section>
      <SectionTitle
        aside={
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" /> Add note
          </button>
        }
      >
        Policies & instructions
      </SectionTitle>

      {adding ? (
        <div className="mb-4 rounded-2xl bg-surface p-4">
          <div className="scrollbar-none -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
            {ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewType(t)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-2.5 text-caption font-medium transition",
                  newType === t ? "bg-brand-500 text-white" : "bg-bg text-ink-2 hover:bg-surface-2",
                )}
              >
                {NOTE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <Textarea
            autoFocus
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="e.g. Late work loses 10% per day, up to 3 days."
            className="min-h-20 bg-bg"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} loading={pending}>
              Save note
            </Button>
          </div>
        </div>
      ) : null}

      {grouped.length === 0 && !adding ? (
        <p className="text-caption text-ink-muted">No policies or instructions captured yet.</p>
      ) : null}

      <div className="space-y-6">
        {grouped.map((g) => {
          const Icon = ICONS[g.type];
          return (
            <div key={g.type}>
              <div className="mb-1.5 flex items-center gap-1.5 text-caption font-semibold text-ink-2">
                <Icon className="h-3.5 w-3.5 text-brand-600" />
                {NOTE_TYPE_LABELS[g.type]}
              </div>
              <ul className="space-y-1">
                {g.items.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    courseId={courseId}
                    onChange={(content) => setNotes((list) => list.map((x) => (x.id === n.id ? { ...x, content } : x)))}
                    onDelete={() => setNotes((list) => list.filter((x) => x.id !== n.id))}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NoteRow({
  note,
  courseId,
  onChange,
  onDelete,
}: {
  note: CourseNote;
  courseId: string;
  onChange: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.content);
  const [pending, start] = useTransition();

  function save() {
    if (!value.trim() || value === note.content) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await updateCourseNote(note.id, courseId, { type: note.type, content: value });
      if (!res.ok) toast.error(res.error);
      else onChange(value.trim());
      setEditing(false);
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteCourseNote(note.id, courseId);
      if (!res.ok) toast.error(res.error);
      else onDelete();
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl bg-surface p-3">
        <Textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="min-h-16 bg-bg" />
        <div className="mt-2 flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={save} loading={pending}>
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2 rounded-xl px-3 py-2 transition hover:bg-surface">
      <p className="flex-1 text-body text-ink-2">{note.content}</p>
      <div className="flex shrink-0 gap-0.5 md:opacity-0 md:transition md:group-hover:opacity-100">
        <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={remove} className="rounded-md p-1 text-ink-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
