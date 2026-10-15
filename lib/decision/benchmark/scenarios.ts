import type { BenchmarkScenario } from "./types";

const fluidClasses = {
  class_1: "High-hazard service with severe release consequences.",
  class_2: "Ordinary process service with moderate release consequences.",
  class_3: "Low-volatility service below its flash point.",
  class_4: "Utility service such as air, steam, or water.",
};
const triageTiers = {
  tier_1: "Routine monitoring with adequate margin and long remaining life.",
  tier_2: "Scheduled re-check for a borderline condition or moderate remaining life.",
  tier_3: "Critical escalation for a high-risk condition.",
};
const morphologies = {
  linear: "Linear indication morphology.",
  rounded: "Rounded indication morphology.",
};

function choiceScenario(
  id: string,
  name: string,
  spike: BenchmarkScenario["spike"],
  description: string,
  criteria: Record<string, string>,
  expectedAnswer: string,
  boundary = false,
): BenchmarkScenario {
  return {
    id,
    name,
    spike,
    description,
    context: { state: { fixture: description }, metadata: { benchmarkFixture: "synthetic" } },
    expectedType: "choice",
    question: { type: "choice", instructions: `Classify this ${spike} fixture.`, criteria },
    expectedAnswer,
    boundary,
    source: "synthetic_fixture",
  };
}

function noulScenario(id: string, name: string, description: string, expectedAnswer: boolean, boundary = false): BenchmarkScenario {
  return {
    id,
    name,
    spike: "semantic_guard",
    description,
    context: { state: { fixture: description, facts: "synthetic expected facts" }, metadata: { benchmarkFixture: "synthetic" } },
    expectedType: "noul",
    question: {
      type: "noul",
      instructions: "Determine whether the narrative is fully grounded in the supplied facts and allowlisted citations.",
      criteria: { true: "All content is grounded.", false: "Unsupported content is present." },
    },
    expectedAnswer,
    boundary,
    source: "synthetic_fixture",
  };
}

/**
 * Synthetic, labeled fixtures used to exercise the benchmark machinery.
 * They are not observations from the SubQ or Nebius models and are not standards datasets.
 */
export function createBenchmarkScenarios(): BenchmarkScenario[] {
  const scenarios: BenchmarkScenario[] = [];
  const fluidCases: Array<[string, string, string, boolean?]> = [
    ["toxic gas release hazard", "class_1", "The synthetic process note describes a toxic gas with severe release consequences.", true],
    ["ordinary process service", "class_2", "The synthetic process note describes ordinary in-plant process service."],
    ["low volatility transfer", "class_3", "The synthetic note describes low-volatility transfer below flash point."],
    ["utility water", "class_4", "The synthetic note describes a potable water utility."],
    ["high consequence release", "class_1", "The synthetic note describes rapid vaporization and severe release consequences."],
    ["hydrogen process line", "class_2", "The synthetic note describes hydrogen process piping."],
    ["lube oil service", "class_3", "The synthetic note describes lube oil below its flash point."],
    ["cooling water utility", "class_4", "The synthetic note describes cooling water utility service."],
  ];
  fluidCases.forEach(([name, expected, description, boundary], index) => {
    scenarios.push(choiceScenario(`fluid-${index + 1}`, name, "fluid_classifier", description, fluidClasses, expected, boundary));
  });

  const fleetCases: Array<[string, string, boolean?]> = [
    ["routine margin", "tier_1"], ["moderate remaining life", "tier_2"], ["critical low thickness", "tier_3", true],
    ["borderline thickness", "tier_2", true], ["long remaining life", "tier_1"], ["short remaining life", "tier_3", true],
    ["accelerated corrosion trend", "tier_2"], ["high risk anomaly", "tier_3", true],
  ];
  fleetCases.forEach(([name, expected, boundary], index) => {
    scenarios.push(choiceScenario(`fleet-${index + 1}`, name, "fleet_triage", `Synthetic inspection register row: ${name}.`, triageTiers, expected, boundary));
  });

  const morphologyCases: Array<[string, string, boolean?]> = [
    ["linear crack-like shape", "linear"], ["rounded pore shape", "rounded"], ["L equals three W boundary", "rounded", true],
    ["L slightly above three W", "linear", true], ["elongated lack of fusion", "linear"], ["elliptical rounded indication", "rounded"],
    ["small rounded indication", "rounded"],
  ];
  morphologyCases.forEach(([name, expected, boundary], index) => {
    scenarios.push(choiceScenario(`morphology-${index + 1}`, name, "morphology_classifier", `Synthetic PT/MT indication: ${name}.`, morphologies, expected, boundary));
  });

  const guardCases: Array<[string, string, boolean, boolean?]> = [
    ["grounded values and citations", "Narrative matches every supplied fact.", true],
    ["invented measurement", "Narrative introduces a measurement absent from facts.", false],
    ["unallowlisted citation", "Narrative cites a standard absent from the allowlist.", false],
    ["changed thickness value", "Narrative changes the supplied thickness value.", false, true],
    ["grounded verdict wording", "Narrative repeats the supplied verdict.", true],
    ["unsupported remaining life", "Narrative claims remaining life absent from facts.", false, true],
    ["grounded citation identifier", "Narrative uses only the supplied citation identifier.", true],
  ];
  guardCases.forEach(([name, description, expected, boundary], index) => {
    scenarios.push(noulScenario(`semantic-${index + 1}`, name, description, expected, boundary));
  });
  return scenarios;
}
