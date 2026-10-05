/**
 * Tokenizer pins — 03-01 Task 1 (Pattern R3 edge cases, each named):
 * all 15 allowlist ids resolve; an invented id yields resolved:false; an
 * unclosed token yields one `incomplete` segment; safeTailHold strips a
 * trailing partial `[[cite:…` while leaving complete prose untouched; token
 * adjacency to numbers segments cleanly.
 */
import { describe, it, expect } from "vitest";
import { tokenize, safeTailHold } from "@/lib/reasoning/tokenizer";
import { criteria } from "@/lib/calc/criteria";

describe("tokenize — resolved ids", () => {
  it("tokenizes every one of the 15 allowlist ids as resolved", () => {
    const ids = criteria.citations.map((c) => c.id);
    expect(ids).toHaveLength(15);
    for (const id of ids) {
      const segments = tokenize(`x [[cite:${id}]] y`);
      expect(segments).toEqual([
        { kind: "text", value: "x " },
        { kind: "cite", id, resolved: true },
        { kind: "text", value: " y" },
      ]);
    }
  });

  it("segments the acceptance example text / cite(resolved) / text", () => {
    expect(tokenize("t-actual 3.85 mm [[cite:api574_10_5_1_4]] ok")).toEqual([
      { kind: "text", value: "t-actual 3.85 mm " },
      { kind: "cite", id: "api574_10_5_1_4", resolved: true },
      { kind: "text", value: " ok" },
    ]);
  });
});

describe("tokenize — unknown and incomplete tokens", () => {
  it("marks an invented id as cite with resolved:false (renderer blanks it)", () => {
    expect(tokenize("x [[cite:not_a_real_id]] y")).toEqual([
      { kind: "text", value: "x " },
      { kind: "cite", id: "not_a_real_id", resolved: false },
      { kind: "text", value: " y" },
    ]);
  });

  it("yields exactly one incomplete segment for an unterminated token", () => {
    const segments = tokenize("ok prose [[cite:api570_7_2");
    expect(segments).toEqual([
      { kind: "text", value: "ok prose " },
      { kind: "incomplete" },
    ]);
  });

  it("keeps ids with digits and underscores whole (grammar [a-z0-9_]+)", () => {
    const segments = tokenize("[[cite:api570_table1]]");
    expect(segments).toEqual([{ kind: "cite", id: "api570_table1", resolved: true }]);
  });

  it("WR-05: a malformed charset id ([[cite:FOO]]) is an UNRESOLVED cite token — never plain text", () => {
    // Historically tokenized as plain TEXT and rendered verbatim (machinery
    // reaching the reader). The widened grammar makes it a zero-glyph cite.
    expect(tokenize("x [[cite:FOO]] y")).toEqual([
      { kind: "text", value: "x " },
      { kind: "cite", id: "FOO", resolved: false },
      { kind: "text", value: " y" },
    ]);
  });

  it("WR-05: an empty id ([[cite:]]) is an UNRESOLVED cite token", () => {
    expect(tokenize("x [[cite:]] y")).toEqual([
      { kind: "text", value: "x " },
      { kind: "cite", id: "", resolved: false },
      { kind: "text", value: " y" },
    ]);
  });
});

describe("tokenize — adjacency", () => {
  it("segments text/cite/text when the token hugs a number", () => {
    expect(tokenize("4.20[[cite:api570_7_2]] mm")).toEqual([
      { kind: "text", value: "4.20" },
      { kind: "cite", id: "api570_7_2", resolved: true },
      { kind: "text", value: " mm" },
    ]);
  });
});

describe("safeTailHold — client chunk-boundary helper", () => {
  it("strips a trailing partial token", () => {
    expect(safeTailHold("ok [[cite:api")).toBe("ok ");
    expect(safeTailHold("ok [[cite:api570_7_2")).toBe("ok ");
    expect(safeTailHold("ok [[cite:")).toBe("ok ");
  });

  it("WR-05: strips a trailing partial with a non-grammar charset in flight", () => {
    // A streamed `[[cite:FO` must hold back too — otherwise machinery text
    // flashes mid-stream for malformed ids.
    expect(safeTailHold("ok [[cite:FO")).toBe("ok ");
    expect(safeTailHold("ok [[cite:F00_bar")).toBe("ok ");
  });

  it("leaves complete prose and closed tokens unchanged", () => {
    expect(safeTailHold("ok [[cite:api570_7_2]] done")).toBe(
      "ok [[cite:api570_7_2]] done",
    );
    expect(safeTailHold("plain narrative text")).toBe("plain narrative text");
  });
});
