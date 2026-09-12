"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { toggleAssignmentComplete } from "@/actions/assignments";
import { courseColor } from "@/lib/colors";
import { ASSIGNMENT_TYPE_LABELS, type AssignmentWithCourse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeadlineItem({
  item,
  dueLabel,
  urgent,
  overdue,
}: {
  item: AssignmentWithCourse;
  dueLabel: string;
  urgent?: boolean;
  overdue?: boolean;
}) {
  const color = courseColor(item.course.color);
  const [completed, setCompleted] = useOptimistic(item.completed);
  const [, start] = useTransition();
  const isExam = item.type === "exam" || item.type === "quiz";

  function toggle() {
    start(async () => {
      setCompleted(!completed);
      const res = await toggleAssignmentComplete(item.id, !completed);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface",
        completed && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={completed ? "Mark as not done" : "Mark as done"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200",
          completed ? "border-brand-500 bg-brand-500 text-white" : "border-line-strong bg-bg hover:border-brand-400",
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform", completed ? "scale-100" : "scale-0")} strokeWidth={3} />
      </button>

      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} aria-hidden />

      <Link href={`/courses/${item.course_id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-body font-medium text-ink", completed && "line-through")}>{item.title}</span>
          {isExam ? (
            <span className="shrink-0 rounded-md bg-danger-soft px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-danger">
              {ASSIGNMENT_TYPE_LABELS[item.type]}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-muted">
          <span className="truncate font-medium" style={{ color: color.text }}>
            {item.course.code ?? item.course.name}
          </span>
          {!isExam ? (
            <>
              <span aria-hidden>·</span>
              <span>{ASSIGNMENT_TYPE_LABELS[item.type]}</span>
            </>
          ) : null}
          {item.weight_percent ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{item.weight_percent}%</span>
            </>
          ) : null}
        </div>
      </Link>

      <span
        className={cn(
          "shrink-0 text-right text-caption tabular",
          overdue ? "font-semibold text-danger" : urgent ? "font-semibold text-brand-700" : "text-ink-muted",
        )}
      >
        {dueLabel}
      </span>
    </li>
  );
}
