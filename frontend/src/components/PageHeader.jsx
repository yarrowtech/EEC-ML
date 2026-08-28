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
}
