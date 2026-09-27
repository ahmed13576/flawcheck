import { getModelValidation } from "@/lib/llm/validate-config";

export const dynamic = "force-dynamic";

// Body whitelist: status, missing[], checkedAt, optional error.
// NEVER the API key, NEVER the full model catalog.
export async function GET() {
  const v = await getModelValidation();
  const status = v.ok ? 200 : 503;
  return Response.json(
    {
      status: v.ok ? "ok" : "degraded",
      missing: v.missing,
      checkedAt: v.checkedAt,
      ...(v.error ? { error: v.error } : {}),
    },
    { status },
  );
}
