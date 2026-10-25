import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PipelineGraph, PIPELINE_NODES } from "@/components/ui/pipeline-graph";

describe("PipelineGraph — dual-engine interactive process visualization", () => {
  it("carries all 5 pipeline nodes with respective engineering standards", () => {
    const markup = renderToStaticMarkup(createElement(PipelineGraph));
    expect(markup).toContain("Dual-Engine Architecture &amp; Verification Flow");
    expect(markup).toContain("Ingestion Register");
    expect(markup).toContain("Deterministic Core");
    expect(markup).toContain("Nebius Token Factory");
    expect(markup).toContain("Linter Guardrail");
    expect(markup).toContain("Certified Report");
  });

  it("articulates Nebius and NVIDIA Nemotron-3.5 integration", () => {
    const markup = renderToStaticMarkup(createElement(PipelineGraph));
    expect(markup).toContain("Nebius Token Factory");
    expect(markup).toContain("NVIDIA Nemotron-3.5");
    expect(markup).toContain("Nemotron-3.5");
  });

  it("articulates ASME B31.3, API 570, and API 574 standards", () => {
    const markup = renderToStaticMarkup(createElement(PipelineGraph));
    expect(markup).toContain("ASME B31.3");
    expect(markup).toContain("API 570");
    expect(markup).toContain("API 574");
  });

  it("has exactly 5 nodes in the architecture model", () => {
    expect(PIPELINE_NODES).toHaveLength(5);
    expect(PIPELINE_NODES.map((n) => n.id)).toEqual([
      "ingest",
      "deterministic",
      "nebius",
      "guardrail",
      "report",
    ]);
  });
});
