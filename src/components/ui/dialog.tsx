"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-bg shadow-lift outline-none",
          // Mobile: bottom sheet. Desktop: centered.
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl p-6 pb-8 safe-bottom",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-7",
          "data-[state=open]:animate-fade-up",
          className,
        )}
        {...props}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-h3 font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-caption text-ink-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
