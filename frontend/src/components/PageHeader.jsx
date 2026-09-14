import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One page header for every student screen — a single, consistent `<h1>` plus an
 * optional eyebrow, description and right-aligned actions slot. Replaces the
 * per-screen heading treatments (sizes ranged 20px–36px with no rule) and gives
 * every view a screen-reader landmark and a "you are here" anchor.
 *
 * Typography matches the rest of the student portal: dark slate headings
 * (#0f172a), muted secondary text (#64748b), soft-purple icon accent (#8b5cf6).
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
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(139,92,246,0.35)] bg-violet-50">
            <Icon className="h-5 w-5 text-[#8b5cf6]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">{eyebrow}</p>
          )}
          <h1 className="text-xl font-bold text-[#0f172a] sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-[#64748b]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
