import * as React from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Accessible confirmation dialog — one shared implementation for every
 * "are you sure?" prompt (logout, delete, discard…). Built on Radix AlertDialog,
 * so focus trapping, focus restore, Esc-to-cancel, scroll lock, `role="alertdialog"`
 * and a labelled title/description all come for free. Replaces `window.confirm`
 * and the hand-rolled `fixed inset-0` modals.
 *
 * Props:
 *  - open, onOpenChange: controlled state
 *  - onConfirm:          called when the primary action is chosen (dialog then closes)
 *  - title, description: strings
 *  - confirmLabel, cancelLabel
 *  - tone:  "danger" (default) | "primary"
 *  - icon:  lucide-react icon component (optional)
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  icon: Icon,
}) {
  const confirmClasses =
    tone === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : "bg-amber-500 hover:bg-amber-600 text-white";
  const accentBar = tone === "danger" ? "from-red-400 to-rose-400" : "from-amber-400 to-orange-400";
  const iconWrap = tone === "danger" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600";

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none"
        >
          <div className={cn("h-1 bg-gradient-to-r", accentBar)} />
          <div className="p-6">
            {Icon && (
              <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl", iconWrap)}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
            <AlertDialog.Title className="text-center text-base font-bold text-slate-900">
              {title}
            </AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="mt-1 text-center text-sm text-slate-500">
                {description}
              </AlertDialog.Description>
            )}
            <div className="mt-5 flex gap-3">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {cancelLabel}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors", confirmClasses)}
                >
                  {confirmLabel}
                </button>
              </AlertDialog.Action>
            </div>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
