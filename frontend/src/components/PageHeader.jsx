import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One page header for every student screen — a single, consistent `<h1>` plus an
 * optional eyebrow, description and right-aligned actions slot. Replaces the
 * per-screen heading treatments (sizes ranged 20px–36px with no rule) and gives
 * every view a screen-reader landmark and a "you are here" anchor.
 *
 * Props:
 *  - eyebrow:     small uppercase kicker above the title (optional)
 *  - title:       the page name (required) — rendered as <h1>
 *  - description: one supporting sentence (optional)
 *  - actions:     React node aligned to the right on wide screens (optional)
 *  - icon:        lucide-react icon component shown beside the title (optional)
 */
export default function PageHeader({ eyebrow, title, description, actions, icon: Icon, className }) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <h1 className="truncate font-heading text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
