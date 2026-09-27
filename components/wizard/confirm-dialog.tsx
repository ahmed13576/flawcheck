"use client";

/**
 * Confirm dialog — hand-rolled focus trap (UI-03, a11y floor 9), tokenized per
 * the Flowstep system in 03-00: focus moves to the safe action (Cancel) on
 * open, Tab cycles inside the dialog, Esc cancels. Copy is the Copywriting
 * Contract verbatim. No packages.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  filename,
  onCancel,
  onReplace,
}: {
  open: boolean;
  filename: string | null;
  onCancel: () => void;
  onReplace: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-confirm-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6"
      >
        <h2 id="replace-confirm-title" className="text-xl font-semibold">
          Replace loaded data?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Dropping a new CSV replaces the current rows and any edits. This cannot be undone.
        </p>
        {filename && <p className="mt-2 text-sm">{filename}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90"
          >
            Replace data
          </button>
        </div>
      </div>
    </div>
  );
}
