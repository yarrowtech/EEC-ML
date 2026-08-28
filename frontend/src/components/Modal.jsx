import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one app modal. Wraps Radix Dialog, so focus trap, focus restore,
 * Esc-to-close, scroll lock, `role="dialog"`, `aria-modal` and a labelled
 * title/description come for free. Use this instead of a hand-built
 * `fixed inset-0` div or a blocking `Swal.fire`.
 *
 *   <Modal open={open} onOpenChange={setOpen} title="Edit preferences">
 *     …body…
 *     <ModalFooter>…buttons…</ModalFooter>
 *   </Modal>
 *
 * Props:
 *  - open, onOpenChange     controlled state
 *  - title                  required — the accessible dialog name
 *  - description            optional sub-line under the title
 *  - size                   "sm" | "md" (default) | "lg"
 *  - hideClose              hide the corner ✕ (Esc / backdrop still close)
 *  - children               modal body
 */
const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  hideClose = false,
  className,
  children,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[200] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
            "max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl focus:outline-none",
            SIZES[size],
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-heading text-base font-semibold text-slate-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-slate-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {!hideClose && (
              <Dialog.Close
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            )}
          </div>
          <div className="px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalFooter({ className, children }) {
  return (
    <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}
