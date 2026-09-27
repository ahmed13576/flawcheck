import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";

// Runtime half of Assumption A1 (install half recorded in plan 01-01):
// @react-pdf/renderer 4.9.0 must render a real buffer under React 19.3.0.
// No JSX needed — build the document tree with React.createElement.
describe("@react-pdf/renderer runtime smoke", () => {
  it("renderToBuffer produces a non-trivial Buffer under React 19.3.0", async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4" },
        React.createElement(Text, null, "FlawCheck spike — react-pdf runtime smoke"),
        React.createElement(Text, null, "If this buffer renders, Phase 4 may consider react-pdf-first."),
      ),
    );

    const buf = await renderToBuffer(doc);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    // PDF magic bytes
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
