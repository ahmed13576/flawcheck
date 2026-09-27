import { z } from "zod";

// Spike-phase Zod schemas. Phase 2+ adds the extraction schemas here (or in lib/calc-
// adjacent modules) — every structured LLM output validates through one of these.
export const HelloSchema = z.object({
  ok: z.literal(true),
  model_note: z.string(),
});

export type Hello = z.infer<typeof HelloSchema>;
