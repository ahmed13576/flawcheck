import { getClient } from "@/lib/llm/client";
import { getReasoningModel } from "@/lib/llm/config";

// Node runtime only — never edge (the openai SDK + env reads need Node).
export const runtime = "nodejs";

// POST /api/spike/stream — relays Token Factory SSE to the browser as
// data: {json} frames ending in the data: [DONE] sentinel.
export async function POST(req: Request) {
  // Parse-boundary validation (ASVS V5): reject bad bodies BEFORE any paid call.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be valid JSON" }, { status: 400 });
  }
  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "prompt must be a non-empty string" }, { status: 400 });
  }

  const model = getReasoningModel();
  let stream: Awaited<ReturnType<ReturnType<typeof getClient>["chat"]["completions"]["create"]>>;
  try {
    stream = await getClient().chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_completion_tokens: 2000,
      reasoning_effort: "low", // 3-value enum ONLY (verified 2026-09-26)
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `upstream model call failed: ${message}` }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async pull(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        // Mid-stream failure: surface an error frame, then close. No resume/replay (FA-06).
        const message = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
  return new Response(sse, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
