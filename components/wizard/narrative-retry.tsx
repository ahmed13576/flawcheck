"use client";

/**
 * One retry affordance for every narrative surface (CML detail rows and PT/MT
 * cards), plus the shared pre-extraction skip scan. Keeping both here means
 * "what is retryable" and "how a retry looks" change in one place (F-14-06).
 */
import type { NarrativeStore } from "@/hooks/use-narrative-stream";
import type { NarrativeRequest } from "@/lib/reasoning/schemas";

export function RetryNarrativeButton({
  blockedMessage,
  onRetry,
}: {
  /** Non-null while extraction is unavailable: the button renders disabled and
   * this sentence explains why no request was sent. */
  blockedMessage?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={blockedMessage ? undefined : onRetry}
        disabled={Boolean(blockedMessage)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Retry narrative
      </button>
      {blockedMessage ? (
        <p className="text-xs text-muted-foreground">{blockedMessage}</p>
      ) : null}
    </div>
  );
}

/**
 * Retry every entry the user opened before extraction finished, through the
 * store's normal FIFO queue. Entries are identified by an explicit error code,
 * never by comparing message text. Idempotent: retry() moves an entry to
 * `loading` synchronously, so a second pass cannot duplicate a request.
 * Exported pure for the node and DOM suites.
 */
export function retrySkippedEntries<T>(args: {
  store: NarrativeStore;
  items: readonly T[];
  allowNarration: boolean;
  keyOf: (item: T, index: number) => string;
  payloadOf: (item: T, index: number) => NarrativeRequest;
}): number {
  if (!args.allowNarration) return 0;
  let retried = 0;
  args.items.forEach((item, index) => {
    const key = args.keyOf(item, index);
    const entry = args.store.get(key);
    if (entry?.status !== "error" || entry.errorCode !== "extraction_not_ready") return;
    args.store.retry(key, args.payloadOf(item, index));
    retried++;
  });
  return retried;
}
