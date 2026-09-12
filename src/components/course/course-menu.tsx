"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCourse, setCourseArchived, updateCourse } from "@/actions/courses";
import { COURSE_COLORS, COURSE_COLOR_KEYS } from "@/lib/colors";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

export function CourseMenu({ course, onUpdated }: { course: Course; onUpdated: (c: Partial<Course>) => void }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: course.name,
    code: course.code ?? "",
    professor: course.professor ?? "",
    term: course.term ?? "",
    color: course.color,
    term_start: course.term_start ?? "",
    term_end: course.term_end ?? "",
  });

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        name: form.name,
        code: form.code || null,
        professor: form.professor || null,
        term: form.term || null,
        color: form.color,
        term_start: form.term_start || null,
        term_end: form.term_end || null,
      };
      const res = await updateCourse(course.id, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onUpdated(payload);
      setEditOpen(false);
    });
  }

  function toggleArchive() {
    start(async () => {
      const res = await setCourseArchived(course.id, !course.archived);
      if (!res.ok) {
        if (res.code === "course_limit") router.push("/upgrade?reason=course_limit");
        else toast.error(res.error);
        return;
      }
      toast.success(course.archived ? "Course restored" : "Course archived");
      router.push("/courses");
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteCourse(course.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Course deleted");
      router.push("/courses");
    });
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="Course options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-44 rounded-xl bg-bg p-1.5 shadow-lift animate-fade-in"
          >
            <Item onSelect={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit details
            </Item>
            <Item onSelect={toggleArchive}>
              {course.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {course.archived ? "Restore course" : "Archive course"}
            </Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <Item onSelect={() => setDeleteOpen(true)} danger>
              <Trash2 className="h-4 w-4" /> Delete course
            </Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Edit course">
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-code">Code</Label>
                <Input id="c-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="c-term">Term</Label>
                <Input id="c-term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="c-prof">Professor</Label>
              <Input id="c-prof" value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-start">Term starts</Label>
                <Input id="c-start" type="date" value={form.term_start} onChange={(e) => setForm({ ...form, term_start: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="c-end">Term ends</Label>
                <Input id="c-end" type="date" value={form.term_end} onChange={(e) => setForm({ ...form, term_end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COURSE_COLOR_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={COURSE_COLORS[k].name}
                    onClick={() => setForm({ ...form, color: k })}
                    className={cn("h-8 w-8 rounded-lg transition hover:scale-110", form.color === k && "ring-2 ring-ink ring-offset-2")}
                    style={{ backgroundColor: COURSE_COLORS[k].hex }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent title="Delete this course?" description="All of its deadlines, grades and notes will be permanently removed.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove} loading={pending}>
              Delete course
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-caption font-medium outline-none transition",
        danger ? "text-danger data-[highlighted]:bg-danger-soft" : "text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
