/**
 * System-1 Decision Provider Entry Point & Factory
 * 
 * Provides unified access to System-1 decision engines.
 */

export * from "./types";
export * from "./providers/nebius-nemotron";

import type { DecisionProvider } from "./types";
import { NebiusNemotronDecisionProvider, type NebiusProviderOptions } from "./providers/nebius-nemotron";

export function createDecisionProvider(options?: NebiusProviderOptions): DecisionProvider {
  return new NebiusNemotronDecisionProvider(options);
}
