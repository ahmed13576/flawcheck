/**
 * Inspection interval per API 570 para. 6.3.3 (half_life_rule,
 * ut-criteria.json inspection_interval_rules, verbatim): "Interval =
 * min(RL / 2, max_interval_by_class); if RL < 4 years, interval = min(RL, 2.0)".
 *
 * Class maxima load from ut-criteria.json max_interval_by_class (API 570
 * Table 1: Class 1 = 5, Class 2 = 10, Class 3 = 10) via criteria.ts — never
 * hard-coded. The 4-year threshold and 2-year short-RL cap are pinned by the
 * API 570 6.3.3 rule text and kept as named module constants citing it.
 *
 * G14 builder decision (checker revision 2026-09-27, verbatim): if RL <= 0
 * with a valid positive CR, nextInterval returns 0 with state
 * "immediate-inspection" — a distinct flag from insufficient-history (RL
 * null); the UI renders "Immediate inspection required" instead of a date;
 * never a negative interval or past date.
 */
import { maxIntervalByClass } from "./criteria";
import { roundTo } from "./round";

export type IntervalState = "ok" | "immediate-inspection";

export interface IntervalResult {
  intervalYears: number;
  state: IntervalState;
  citationIds: string[];
}

/** API 570 6.3.3: "if RL < 4 years, interval may be full remaining life..." */
const RL_FULL_LIFE_THRESHOLD_YR = 4.0;
/** API 570 6.3.3: "...up to maximum 2 years" on the short-RL branch. */
const SHORT_RL_MAX_INTERVAL_YR = 2.0;

const CITATION_IDS = ["api570_6_3_3_halflife", "api570_table1"];

export function nextInterval(rlYears: number, pipeClass: 1 | 2 | 3): IntervalResult {
  if (rlYears <= 0) {
    // G14: a component at/below t_required is already FAIL — direct immediate
    // action, no computed interval. Distinct from insufficient-history (RL null).
    return { intervalYears: 0, state: "immediate-inspection", citationIds: CITATION_IDS };
  }
  const classMax = maxIntervalByClass(pipeClass);
  const intervalYears =
    rlYears < RL_FULL_LIFE_THRESHOLD_YR
      ? Math.min(rlYears, SHORT_RL_MAX_INTERVAL_YR)
      : Math.min(rlYears / 2, classMax ?? Number.POSITIVE_INFINITY);
  return { intervalYears: roundTo(intervalYears, 2), state: "ok", citationIds: CITATION_IDS };
}
