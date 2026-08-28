import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Neutral loading placeholder. Use instead of `return null` so a screen keeps a
 * stable shape while data resolves (no cumulative layout shift, no blank flash).
 * The pulse is purely decorative and is disabled under `prefers-reduced-motion`
 * by the global rule in index.css.
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

export { Skeleton };
