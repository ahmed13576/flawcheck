"use client";

/**
 * Confirm dialog — hand-rolled focus trap (UI-03, a11y floor 9): focus moves
 * to the safe action (Cancel) on open, Tab cycles inside the dialog, Esc
 * cancels. Copy is the Copywriting Contract verbatim. No packages.
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
        className="w-full max-w-md rounded-lg border border-[#262626] bg-[#171717] p-6"
      >
        <h2 id="replace-confirm-title" className="text-xl font-semibold">
          Replace loaded data?
        </h2>
        <p className="mt-2 text-sm text-[#a3a3a3]">
          Dropping a new CSV replaces the current rows and any edits. This cannot be undone.
        </p>
        {filename && <p className="mt-2 text-sm">{filename}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded border border-[#262626] px-4 py-2 text-sm font-semibold hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Replace data
          </button>
        </div>
      </div>
    </div>
  );
}
