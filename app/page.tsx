import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">FlawCheck spike</h1>
      <p className="text-sm opacity-70">Phase 1 — platform spike (Token Factory routing, validated calls, SSE).</p>
      <Link
        href="/spike"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Open the streaming spike
      </Link>
    </main>
  );
}
