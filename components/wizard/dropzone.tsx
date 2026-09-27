"use client";

/**
 * Dropzone — Screen 1 primary region (UI-SPEC Dropzone Interaction Contract,
 * restyled per Flowstep Screen 1 mock in 03-00). Idle: dashed token border,
 * centered lucide Upload icon in the orange primary + 'Drop your UT thickness
 * CSV here' + 'CSV up to 25 MB · Your file stays in this workspace' + Browse
 * files affordance. Dragover: border-primary bg-primary/5, reverting on
 * dragleave/drop (UI-01). Keyboard parity: the whole dropzone is a real
 * <button> — Enter/Space open browse; drag is never the only path (a11y
 * floor 3). Handlers byte-identical to the Phase-2 contract.
 */
import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";

export function Dropzone({
  disabled,
  onFile,
}: {
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const openBrowse = () => inputRef.current?.click();

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragover(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={openBrowse}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        className={`flex min-h-56 w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-sm transition-colors disabled:opacity-50 ${
          dragover
            ? "border-primary bg-primary/5"
            : "border-border bg-transparent hover:border-muted-foreground/50"
        }`}
      >
        <Upload className="size-8 text-primary" aria-hidden="true" />
        <span className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-medium">Drop your UT thickness CSV here</span>
          <span className="text-muted-foreground">
            CSV up to 25 MB · Your file stays in this workspace
          </span>
        </span>
        <span className="rounded-md bg-secondary px-6 py-2.5 text-sm font-medium text-secondary-foreground">
          Browse files
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
