"use client";

/**
 * Dropzone — Screen 1 primary region (UI-SPEC Dropzone Interaction Contract).
 * Idle: dashed 2px border-gray-700, min-h-40, centered 20px upload SVG icon +
 * 'Drop UT thickness CSV here' + 'or' + Browse files link. Dragover:
 * border-blue-500 bg-blue-500/5, reverting on dragleave/drop (UI-01).
 * Keyboard parity: the whole dropzone is a real <button> — Enter/Space open
 * browse; drag is never the only path (a11y floor 3).
 */
import { useRef, useState, type DragEvent } from "react";

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
        className={`flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors disabled:opacity-50 ${
          dragover
            ? "border-blue-500 bg-blue-500/5"
            : "border-gray-700 bg-transparent hover:border-gray-500"
        }`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[#a3a3a3]"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="font-semibold">Drop UT thickness CSV here</span>
        <span className="text-[#a3a3a3]">
          or{" "}
          <span className="text-[#2563eb] underline underline-offset-2">Browse files</span>
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
