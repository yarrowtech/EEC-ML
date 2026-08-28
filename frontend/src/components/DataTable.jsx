import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared data table. Renders a real semantic <table> with a sticky header on
 * sm+ screens, and a card-per-row list below sm so a phone user never has to
 * scroll sideways to read a row. Wrap-scrolls horizontally inside its own
 * container if the table is genuinely too wide.
 *
 * Props:
 *  - columns:    [{ key, header, align?: 'left'|'right'|'center', className?, render?(row) }]
 *  - rows:       array of row objects
 *  - getRowKey:  (row, index) => string        (default: index)
 *  - caption:    accessible table caption (visually hidden)
 *  - onRowClick: (row) => void                 (optional — makes rows interactive)
 *  - mobileCard: (row) => ReactNode            (optional — custom card body under sm)
 *  - empty:      ReactNode shown when rows is empty (e.g. <EmptyState/>)
 */
export default function DataTable({
  columns,
  rows,
  getRowKey = (_row, i) => i,
  caption,
  onRowClick,
  mobileCard,
  empty,
  className,
}) {
  const alignClass = (a) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (!rows || rows.length === 0) {
    return empty ?? null;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Table — sm and up */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-10 bg-slate-50 px-4 py-2.5 font-semibold text-slate-600",
                    alignClass(col.align),
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-slate-100 last:border-0",
                  onRowClick && "cursor-pointer transition-colors hover:bg-amber-50/50"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-slate-700", alignClass(col.align), col.className)}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card-per-row — below sm */}
      <ul className="space-y-2.5 sm:hidden">
        {rows.map((row, i) => (
          <li
            key={getRowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "rounded-xl border border-slate-200 bg-white p-3.5",
              onRowClick && "cursor-pointer transition-colors active:bg-amber-50/50"
            )}
          >
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <dl className="space-y-1.5">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-slate-400">{col.header}</dt>
                    <dd className="min-w-0 text-right text-sm text-slate-700">
                      {col.render ? col.render(row) : row[col.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
