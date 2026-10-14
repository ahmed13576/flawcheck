/**
 * System-1 Decision Provider Entry Point & Factory (SubQ Snap Fork)
 * 
 * Provides unified access to SubQ Snap decision engine.
 */

export * from "./types";
export * from "./providers/subq-snap";

import type { DecisionProvider } from "./types";
import { SubQSnapDecisionProvider, type SubQProviderOptions } from "./providers/subq-snap";

export function createDecisionProvider(options?: SubQProviderOptions): DecisionProvider {
  return new SubQSnapDecisionProvider(options);
}
