import { describe, expect, it } from "vitest";
import { ALL_READING_FLAGS } from "@/lib/ingest/session";
import { ReadingFlagSchema } from "@/lib/report/snapshot-schema";

describe("ReadingFlag schema parity", () => {
  it("accepts every ReadingFlag member emitted by the engine", () => {
    for (const flag of ALL_READING_FLAGS) {
      expect(ReadingFlagSchema.safeParse(flag).success, flag).toBe(true);
    }
  });

  it("schema options exactly match the canonical union list", () => {
    expect([...ReadingFlagSchema.options].sort()).toEqual([...ALL_READING_FLAGS].sort());
  });
});
