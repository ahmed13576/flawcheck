/**
 * Tests for the Decision 5 and Decision 6 presentation components (locked
 * 2026-10-19 in 09-CONTEXT.md). These run hermetically under
 * FLAWCHECK_DISABLE_LLM=1 and validate that the explanation layer narrates
 * around the PRECOMPUTED distribution — it never re-classifies — and that
 * the guard failure report keeps the two remediation audiences distinct.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FailClosedReviewBlock,
  sortDistributionForDisplay,
} from "../../components/review/fail-closed-review-block";
import {
  GuardFailureReport,
} from "../../components/review/guard-failure-report";

const DISTRIBUTION = {
  class_1: 0.62,
  class_3: 0.58,
  class_2: 0.13,
  class_4: 0.04,
};

describe("FailClosedReviewBlock (Decision 5)", () => {
  const base = {
    choice: "class_1",
    probabilities: DISTRIBUTION,
    threshold: 0.85,
    inputSnippet: "trace H2S present, operating pressure not stated",
    disambiguatingEvidence: [
      "Process datasheet fluid composition",
      "Operating pressure and temperature at the measurement point",
    ],
    remedialSteps: [
      "Confirm fluid service class against the process datasheet per API 570 §6.3",
      "Route the manual review result to the Level 2 inspector of record",
    ],
  };

  it("renders the full precomputed probability distribution verbatim", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    // Every competing class and its exact probability appears — the full
    // distribution travels on the result and is rendered verbatim.
    for (const [cls, p] of Object.entries(DISTRIBUTION)) {
      expect(html).toContain(cls);
      expect(html).toContain((p * 100).toFixed(1) + "%");
    }
  });

  it("marks the selected class without re-classifying", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    expect(html).toContain('data-testid="fail-closed-choice"');
    expect(html).toContain("class_1");
    expect(html).toContain("no re-classification");
  });

  it("shows the input snippet that drove the uncertainty", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    expect(html).toContain('data-testid="fail-closed-input-snippet"');
    expect(html).toContain("trace H2S present, operating pressure not stated");
  });

  it("lists disambiguating evidence and remedial steps", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    expect(html).toContain("Process datasheet fluid composition");
    expect(html).toContain("per API 570 §6.3");
  });

  it("states the fail-closed threshold explicitly", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    expect(html).toContain("p &lt; 0.85");
  });

  it("renders as an alert with an accessible name", () => {
    const html = renderToStaticMarkup(createElement(FailClosedReviewBlock, base));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Manual review required");
  });
});

describe("sortDistributionForDisplay", () => {
  it("sorts the precomputed distribution descending without re-classifying", () => {
    const sorted = sortDistributionForDisplay(DISTRIBUTION);
    expect(sorted[0].className).toBe("class_1");
    expect(sorted[0].probability).toBeCloseTo(0.62, 6);
    expect(sorted[sorted.length - 1].className).toBe("class_4");
  });

  it("does not mutate the caller's distribution object", () => {
    const copy = { ...DISTRIBUTION };
    sortDistributionForDisplay(copy);
    expect(copy).toEqual(DISTRIBUTION);
  });
});

describe("GuardFailureReport (Decision 6)", () => {
  const base = {
    narrativeClaim: "The pipeline is classified as Class 4 utility water service with 15 years of remaining life.",
    precomputedVerdict: "re_check — t_actual 6.50 mm vs t_required 6.35 mm",
    deterministicFallbackServed: true,
    developerRemediation: "Review run 2026-10-19T10:12Z in the decision audit log; the numeric lint flagged an ungrounded remaining-life figure.",
  };

  it("states what the narrative claimed", () => {
    const html = renderToStaticMarkup(createElement(GuardFailureReport, base));
    expect(html).toContain("What the narrative claimed");
    expect(html).toContain(base.narrativeClaim);
  });

  it("states the precomputed verdict", () => {
    const html = renderToStaticMarkup(createElement(GuardFailureReport, base));
    expect(html).toContain("What the precomputed verdict actually is");
    expect(html).toContain(base.precomputedVerdict);
  });

  it("states that the deterministic fallback was served", () => {
    const html = renderToStaticMarkup(createElement(GuardFailureReport, base));
    expect(html).toContain("deterministic fallback verdict was served");
    expect(html).toContain("Trust the fallback verdict");
  });

  it("keeps operator/developer remediation distinct from inspector guidance (Decision 6)", () => {
    const html = renderToStaticMarkup(createElement(GuardFailureReport, base));
    // Developer-facing block: audit log, prompt/lint remediation.
    expect(html).toContain('data-testid="guard-developer-remediation"');
    expect(html).toContain("Inspect the audit log");
    expect(html).toContain("Fix the prompt or the numeric/citation lint");
    expect(html).toContain(base.developerRemediation);
    // Inspector-facing block: fallback verdict only — never prompt internals.
    expect(html).toContain('data-testid="guard-inspector-guidance"');
    expect(html).toContain("Trust the fallback verdict");
    // The inspector-facing block must not contain developer internals.
    const inspectorBlock = html
      .slice(html.indexOf('data-testid="guard-inspector-guidance"'))
      .slice(0, 2000);
    expect(inspectorBlock).not.toContain("audit log");
    expect(inspectorBlock).not.toContain(base.developerRemediation);
  });

  it("handles the no-fallback-served case explicitly", () => {
    const html = renderToStaticMarkup(
      createElement(GuardFailureReport, {
        ...base,
        deterministicFallbackServed: false,
      }),
    );
    expect(html).toContain("No fallback was served");
  });

  it("renders as an alert with an accessible name", () => {
    const html = renderToStaticMarkup(createElement(GuardFailureReport, base));
    expect(html).toContain('role="alert"');
    expect(html).toContain("reasoned failure report");
  });
});
