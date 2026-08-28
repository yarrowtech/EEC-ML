import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared empty / zero-data panel. One voice, one layout for "nothing here yet"
 * across every student screen, with an optional call-to-action.
 *
 * Props:
 *  - icon:        lucide-react icon component (optional)
 *  - title:       short headline (required)
 *  - description: one or two supporting sentences (optional)
 *  - action:      React node rendered below the text — a button or link (optional)
 *  - compact:     tighter padding for in-card use (optional)
 */
export default function EmptyState({ icon: Icon, title, description, action, compact = false, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8 px-4" : "gap-3 py-14 px-6",
        className
      )}
    >
      {Icon && (
        <div className={cn(
          "flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}>
          <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} aria-hidden="true" />
        </div>
      )}
      <p className={cn("font-semibold text-slate-800", compact ? "text-sm" : "text-base")}>{title}</p>
      {description && (
        <p className={cn("max-w-sm text-slate-500", compact ? "text-xs" : "text-sm")}>{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
