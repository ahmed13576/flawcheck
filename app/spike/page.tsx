"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface HealthBody {
  status: "ok" | "degraded";
  missing: string[];
  checkedAt: string;
  error?: string;
}

export default function SpikePage() {
  const [prompt, setPrompt] = useState("Reply with exactly: streaming ok");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState<HealthBody | null>(null);
  const outRef = useRef<HTMLElement | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      setHealth((await res.json()) as HealthBody);
    } catch {
      setHealth(null);
    }
  }, []);

  // Poll /api/health on mount, then every 30s — the red banner must be current.
  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, [checkHealth]);

  async function runSpike() {
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/spike/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setOutput(`Request failed (${res.status}): ${errBody?.error ?? res.statusText}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE events are \n\n-separated; only process complete events,
        // keep the trailing partial in the buffer.
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const payload = event.slice(6);
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.error) {
              setOutput((prev) => prev + `\n[stream error] ${parsed.error}`);
            } else if (parsed.text) {
              setOutput((prev) => prev + parsed.text); // incremental render
            }
          } catch {
            // ignore malformed frames
          }
        }
      }
    } catch (e) {
      setOutput(`Request failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {health && health.status === "degraded" && (
        <div role="alert" className="fixed top-0 left-0 right-0 z-50 bg-red-600 px-4 py-2 text-sm text-white">
          Model routing invalid — missing: {health.missing.join(", ")}. Update .env.local / Vercel env vars.
        </div>
      )}
      <h1 className="mb-4 text-xl font-semibold">Token Factory streaming spike</h1>
      <p className="mb-6 text-sm opacity-70">
        Health: {health ? health.status : "unknown"}
        {health ? ` (checkedAt ${health.checkedAt})` : ""}
      </p>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt"
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={runSpike}
          disabled={running || prompt.trim().length === 0}
        >
          {running ? "Streaming…" : "Run"}
        </button>
      </div>
      <section ref={outRef} className="min-h-40 whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm dark:bg-gray-900" aria-live="polite">
        {output || "Output appears here as frames arrive."}
      </section>
    </main>
  );
}
