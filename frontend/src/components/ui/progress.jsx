import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

const ProgressLabel = ({ className, children, ...props }) => (
  <span className={cn("text-xs font-semibold text-slate-700 dark:text-slate-200", className)} {...props}>
    {children}
  </span>
)

const ProgressValue = ({ className, value, children, ...props }) => (
  <span className={cn("text-xs font-semibold text-slate-500 dark:text-slate-400", className)} {...props}>
    {children ?? `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`}
  </span>
)

export { Progress, ProgressLabel, ProgressValue }
