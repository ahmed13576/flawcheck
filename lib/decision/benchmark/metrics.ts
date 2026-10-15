import type {
  CalibrationMetrics,
  CalibrationObservation,
  CostMetrics,
  LatencyDistribution,
  TokenPricingPerMillion,
} from "./types";

export function calculateLatencyDistribution(samples: number[]): LatencyDistribution {
  const valid = samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (valid.length === 0) {
    return { minMs: 0, maxMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0 };
  }
  const percentile = (p: number) => valid[Math.max(0, Math.ceil((p / 100) * valid.length) - 1)];
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return {
    minMs: valid[0],
    maxMs: valid[valid.length - 1],
    meanMs: round(mean, 3),
    p50Ms: percentile(50),
    p90Ms: percentile(90),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
  };
}

export function calculateCalibrationMetrics(observations: CalibrationObservation[]): CalibrationMetrics {
  if (observations.length === 0) {
    return { brierScore: null, expectedCalibrationError: null, boundaryAccuracy: null };
  }
  if (observations.some(({ probability }) => !Number.isFinite(probability) || probability < 0 || probability > 1)) {
    throw new RangeError("Calibration probabilities must be finite values in [0, 1].");
  }

  const brierScore = observations.reduce((sum, observation) => {
    const error = observation.probability - Number(observation.correct);
    return sum + error * error;
  }, 0) / observations.length;

  const bins = Array.from({ length: 10 }, () => ({ count: 0, confidence: 0, accuracy: 0 }));
  for (const observation of observations) {
    const index = Math.min(9, Math.floor(observation.probability * 10));
    const bin = bins[index];
    bin.count++;
    bin.confidence += observation.probability;
    bin.accuracy += Number(observation.correct);
  }
  const expectedCalibrationError = bins.reduce((sum, bin) => {
    if (bin.count === 0) return sum;
    const weight = bin.count / observations.length;
    return sum + weight * Math.abs(bin.accuracy / bin.count - bin.confidence / bin.count);
  }, 0);

  const boundary = observations.filter((observation) => observation.boundary);
  return {
    brierScore: round(brierScore, 6),
    expectedCalibrationError: round(expectedCalibrationError, 6),
    boundaryAccuracy: boundary.length === 0 ? null : round(boundary.filter((item) => item.correct).length / boundary.length, 6),
  };
}

export function calculateCostMetrics(
  inputTokens: number,
  outputTokens: number,
  totalEvaluations: number,
  pricing?: TokenPricingPerMillion,
): CostMetrics {
  if (![inputTokens, outputTokens, totalEvaluations].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError("Token counts and evaluation count must be non-negative finite values.");
  }
  if (pricing && (![pricing.inputUsd, pricing.outputUsd].every((value) => Number.isFinite(value) && value >= 0))) {
    throw new RangeError("Token prices must be non-negative finite USD per million tokens.");
  }
  const estimatedCostPer1kUsd = pricing && totalEvaluations > 0
    ? round(((inputTokens * pricing.inputUsd + outputTokens * pricing.outputUsd) / totalEvaluations) * 1000 / 1_000_000, 9)
    : null;
  return { totalInputTokens: inputTokens, totalOutputTokens: outputTokens, estimatedCostPer1kUsd };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
