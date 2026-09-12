import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          {icon}
        </div>
      ) : null}
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-body text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
