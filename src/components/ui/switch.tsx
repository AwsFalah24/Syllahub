"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-brand-500 data-[state=unchecked]:bg-line-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
});
