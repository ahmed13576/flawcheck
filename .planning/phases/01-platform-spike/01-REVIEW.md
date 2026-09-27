---
phase: 01-platform-spike
reviewed: 2026-09-27T06:42:14Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/api/health/route.ts
  - app/api/spike/stream/route.ts
  - app/layout.tsx
  - app/page.tsx
  - app/spike/page.tsx
  - instrumentation.ts
  - lib/llm/client.ts
  - lib/llm/complete.ts
  - lib/llm/config.ts
  - lib/llm/schemas.ts
  - lib/llm/validate-config.ts
  - scripts/dump-model-catalog.mjs
  - tests/llm/hello-fixture.test.ts
  - tests/llm/validate-config.offline.test.ts
  - tests/llm/validated-call.retry.test.ts
  - tests/pdf/react-pdf-smoke.test.ts
  - vitest.config.ts
  - next.config.ts
  - tsconfig.json
  - eslint.config.mjs
  - .env.example
  - .gitignore
  - package.json
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: findings
fixed:
  - WR-01
  - WR-02
  - WR-03
  - INFO-fresh-clone
  - INFO-dead-code
dispositions:
  - IN-01
  - IN-02
  - IN-03
  - IN-06
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-27T06:42:14Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** findings

## Summary

Adversarial review of the Phase 1 platform spike: lib/llm seam (config, client, validated calls), health endpoint, SSE route + client consumer, startup instrumentation, catalog dump script, offline/live tests, and build/test config.

The security substrate held up under verification, not just inspection: `NEBIUS_API_KEY` exists only in `.env.local` (confirmed untracked; `.gitignore` `.env*` + `!.env.example`), it is read exclusively through `lib/llm/config.ts:getApiKey()` with no `NEXT_PUBLIC_` exposure, and greps of app/ lib/ scripts/ tests/ instrumentation.ts found zero `nvidia/` model-ID literals, zero key-like literals, and zero debug artifacts. The health endpoint strictly whitelists its response body (status/missing/checkedAt/error only). The validated-call contract is genuinely enforced: `complete.ts` loops `attempt < 2` (exactly one bounded retry, max 2 upstream calls) and is pinned offline by an injected fake client asserting exact call counts with zero network; live tests skip cleanly via `skipIf(!HAS_KEY)`.

Three warnings are worth fixing before Phases 2-5 copy these patterns: the SSE route never propagates client disconnects upstream (paid tokens keep streaming after the browser leaves, and its mid-stream error handler double-throws on the cancel path); the retry conversation omits the model's own previous reply (the "corrected JSON" instruction references context the model never sees, and this payload shape was never exercised live); and the degraded-health red banner renders an empty "missing:" for exactly the most common failure case (env vars unset), even though the API response carries the actionable `error` text. No Critical issues found.

## Warnings

### WR-01: SSE route ignores client disconnects — upstream paid call continues and the error path double-throws on cancel

**File:** `app/api/spike/stream/route.ts:25-54`
**Issue:** The OpenAI create call (line 25) is never given `req.signal`, and the ReadableStream `pull` (line 39) never checks for cancellation. When the browser disconnects mid-stream, Next cancels the stream but the `for await (const chunk of stream)` (line 41) keeps consuming the upstream Token Factory response to completion — burning paid tokens for a client that is gone (the exact credit-burn concern in PITFALLS "Auth-less open demo endpoint" row). Additionally, once cancelled, the next `controller.enqueue` (line 43) throws `TypeError` (controller closed); the catch at line 47 then calls `controller.enqueue` again at line 50, which throws a second TypeError out of the catch block — the mid-stream error handler itself fails on the disconnect path.
**Fix:**
```ts
// Abort upstream when the client goes away:
const stream = await getClient().chat.completions.create(
  { model, messages: [...], stream: true, max_completion_tokens: 2000, reasoning_effort: "low" },
  { signal: req.signal },
);

// Guard every enqueue against a closed/cancelled controller:
let closed = false;
const safeEnqueue = (frame: string) => {
  if (closed) return;
  try {
    controller.enqueue(encoder.encode(frame));
  } catch {
    closed = true;
  }
};
```
Use `safeEnqueue` for data, error, and `[DONE]` frames; on cancel the SDK iterator also terminates via the signal instead of running to completion.

### WR-02: Retry conversation omits the assistant's previous reply — correction references context the model never sees, and this shape was never verified live

**File:** `lib/llm/complete.ts:37-49`
**Issue:** On the retry attempt, messages become `[system, user(original), user("Your previous reply failed validation: ...")]`. The model's own bad output is not included as an assistant turn, so "reply again with corrected JSON" asks the model to correct a reply it cannot see; the retry also relies on two consecutive `user` messages, a payload shape exercised only against the offline fake — the live fixtures (hello-fixture.test.ts) cover the success path only, so the retry payload has never been proven against Token Factory. A provider that mangles or mishandles consecutive same-role turns would silently degrade the retry that Phases 2-4 depend on for structured extraction.
**Fix:**
```ts
attempt === 1
  ? {
      messages: [
        ...messages,
        { role: "assistant" as const, content: previousRaw }, // the model sees its own bad output
        { role: "user" as const, content: `That reply failed validation: ${lastError}. Reply again with corrected JSON only.` },
      ],
    }
  : {},
```
(capture `previousRaw` from the prior attempt), and add one live fixture that forces a single retry to prove the shape against both routed models.

### WR-03: Degraded-health red banner shows an empty "missing:" for the env-unset case — `error` is returned by the API but never rendered

**File:** `app/spike/page.tsx:87-91`
**Issue:** When env vars are missing, `validateModelConfig` throws before the catalog call (`lib/llm/validate-config.ts:23` reads env accessors outside its try), so the cached result is `{ ok: false, missing: [], error: "Missing required env var: NEBIUS_MODEL_REASONING..." }`. The banner condition (`status === "degraded"`) correctly fires, but the message renders `missing: ${health.missing.join(", ")}` — producing "Model routing invalid — missing: ." with zero actionable content. The `error` field the health endpoint deliberately whitelists is displayed nowhere in the UI, so the most common misconfiguration (missing `.env.local`) gets the least useful banner.
**Fix:**
```tsx
Model routing invalid —{" "}
{health.missing.length > 0
  ? `missing: ${health.missing.join(", ")}`
  : (health.error ?? "validation failed")}. Update .env.local / Vercel env vars.
```

## Info

### IN-01: Upstream error text passed through verbatim to unauthenticated endpoints

**File:** `app/api/health/route.ts:15`, `app/api/spike/stream/route.ts:34`
**Issue:** Both unauthenticated routes embed raw exception messages from the OpenAI SDK (`v.error`, 502 `message`) in responses. Verified the SDK message carries status/body text, not the key or request headers, so this is not a secret leak — but internal upstream detail (endpoint errors, quota bodies) is disclosed to any caller, which ASVS error-handling guidance flags for public deployment.
**Fix:** Return a generic message ("model validation failed" / "upstream model call failed") and `console.error` the detail server-side.

### IN-02: SSE prompt length uncapped before the paid call

**File:** `app/api/spike/stream/route.ts:18-20`
**Issue:** Parse-boundary validation checks type/emptiness only; a multi-megabyte prompt passes and is forwarded to a paid completion. Phase 5 will add guarding, but a one-line cap now removes the accidental-credit-burn vector during local demos.
**Fix:** `if (prompt.length > 10_000) return Response.json({ error: "prompt too long" }, { status: 413 });`

### IN-03: `register()` "never throws" invariant holds only if the dynamic import resolves

**File:** `instrumentation.ts:6-9`
**Issue:** `validateAndCacheModelConfig` swallows validation errors, but the `await import("./lib/llm/validate-config")` itself is outside any try — a module-load failure (bad dependency install, bundling error) rejects `register()` and the claimed no-crash guarantee is untested for that path.
**Fix:**
```ts
try {
  const { validateAndCacheModelConfig } = await import("./lib/llm/validate-config");
  await validateAndCacheModelConfig();
} catch (e) {
  console.error(`[instrumentation] startup validation unavailable (startup continues): ${e}`);
}
```

### IN-04: `npm run typecheck` fails on a fresh clone

**File:** `tsconfig.json:25-31`
**Issue:** `include` requires `next-env.d.ts` (gitignored by the Next 16 scaffold convention) and `.next/types/**` — neither exists until a first `next dev`/`next build`/`next typegen` run, so `LayoutProps<"/">` in `app/layout.tsx:20` is an unresolved type and `tsc --noEmit` errors out-of-the-box on a public-repo clone.
**Fix:** Document "run `npm run dev` (or `npx next typegen`) once before typecheck" in the setup README, or add a `pretypecheck` script running `next typegen`.

### IN-05: Dead ref `outRef` in the spike page

**File:** `app/spike/page.tsx:17,112`
**Issue:** `outRef` is declared and attached to the output `<section>` but never read — dead code (presumably a future autoscroll).
**Fix:** Remove the ref, or implement the autoscroll it implies (`outRef.current?.scrollIntoView(...)` as frames arrive).

### IN-06: Scaffold metadata left in root layout

**File:** `app/layout.tsx:15-18`
**Issue:** `title: "Create Next App"`, `description: "Generated by create next app"` — create-next-app leftovers contradict the branded home page and will leak into browser tabs/social previews if deployed before Phase 5 restyles them.
**Fix:** `title: "FlawCheck", description: "NDT inspection copilot — deterministic acceptance, code-cited reports"` (or Phase-1-appropriate copy).

## Dispositions

Accepted for now — spike-phase scope; Phase 5 hardening owns these:

- **IN-01** (upstream error text passed through verbatim): accepted — verified not a secret leak (SDK message carries status/body text only, no key or headers); generic-message + server-side detail logging lands with Phase 5 error-handling hardening.
- **IN-02** (SSE prompt length uncapped before the paid call): accepted — spike demo scope; Phase 5 owns request guarding, which subsumes the one-line cap.
- **IN-03** (register() dynamic import outside any try): accepted — the startup-continues invariant holds for all validation failures; module-load failure handling is owned by Phase 5 hardening.
- **IN-06** (scaffold metadata in root layout): accepted — branding/copy is owned by the Phase 5 restyle; no functional impact during the spike.

---

_Reviewed: 2026-09-27T06:42:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
