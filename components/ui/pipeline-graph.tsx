"use client";

import { useState } from "react";
import {
  Database,
  Cpu,
  Zap,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

export interface PipelineNode {
  id: string;
  step: number;
  label: string;
  sublabel: string;
  badge: string;
  badgeColor: string;
  standards: string;
  invariant: string;
  codePath: string;
  description: string;
  icon: typeof Database;
}

export const PIPELINE_NODES: PipelineNode[] = [
  {
    id: "ingest",
    step: 1,
    label: "Ingestion Register",
    sublabel: "UT CMLs & PT/MT Data",
    badge: "Client-Side Ingestion",
    badgeColor: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    standards: "Zenodo 16780668 & CSV Scantlings",
    invariant: "Pre-allocation 25 MB memory gate. Zero network transmission before evaluation.",
    codePath: "lib/ingest/validate.ts",
    description:
      "Validates UT thickness readings, component metadata, and weld surface indications. Aliases auto-map and units normalize before any processing.",
    icon: Database,
  },
  {
    id: "deterministic",
    step: 2,
    label: "Deterministic Core",
    sublabel: "ASME B31.3 & API 574",
    badge: "Zero-LLM Math",
    badgeColor: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    standards: "ASME B31.3 §304.1.2 · API 574 Annex D · API 570 §7.1",
    invariant: "Pure TypeScript arithmetic. LLMs never compute thicknesses, rates, or remaining life.",
    codePath: "lib/calc/evaluate.ts",
    description:
      "Calculates internal pressure t-min (Eq. 3a or Barlow), structural t-min, short/long-term corrosion rates, and enforces remaining life clamp (RL ≥ 0.0 yr per API 570 §7.1.1).",
    icon: Cpu,
  },
  {
    id: "nebius",
    step: 3,
    label: "Nebius Token Factory",
    sublabel: "NVIDIA Nemotron-3.5",
    badge: "High-Performance AI",
    badgeColor: "border-primary/30 bg-primary/10 text-primary",
    standards: "Nebius Inference Platform · Nemotron-3.5",
    invariant: "Domain-scoped prompt contracts. Model synthesizes engineering reasoning without touching math.",
    codePath: "lib/reasoning/narrative-context.ts",
    description:
      "Leverages ultra-low latency token generation on Nebius Cloud to analyze metallurgical damage mechanisms, corrosion morphology, and inspection history.",
    icon: Zap,
  },
  {
    id: "guardrail",
    step: 4,
    label: "Linter Guardrail",
    sublabel: "Anti-Hallucination AST",
    badge: "Deterministic Gate",
    badgeColor: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    standards: "Strict Citation Allowlist (citations.json)",
    invariant: "Any sentence mentioning unverified clauses or invented numbers is stripped or retried.",
    codePath: "lib/reasoning/lints.ts",
    description:
      "Validates every model output token against verified clause allowlists. Prevents hallucinations of non-existent code standards or false tolerances.",
    icon: ShieldCheck,
  },
  {
    id: "report",
    step: 5,
    label: "Certified Report",
    sublabel: "Audit Stamp & PDF",
    badge: "Defensible Output",
    badgeColor: "border-green-500/30 bg-green-500/10 text-green-400",
    standards: "API 570 Certified Record & SHA-256 Seal",
    invariant: "Full dataset bound under cryptographic SHA-256 seal with 4-field inspector sign-off.",
    codePath: "components/report/pdf-document.tsx",
    description:
      "Generates auditable PDF certificate rendering top critical CMLs and complete metadata under a tamper-evident WebCrypto data fingerprint.",
    icon: FileCheck2,
  },
];

export function PipelineGraph({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [selectedNode, setSelectedNode] = useState<PipelineNode>(PIPELINE_NODES[1]);
  const [expanded, setExpanded] = useState<boolean>(!compact);

  return (
    <section
      aria-label="FlawCheck Dual-Engine Pipeline Architecture"
      className={`rounded-xl border border-border bg-card p-5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Dual-Engine Architecture & Verification Flow</h2>
          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline">
            Deterministic + LLM
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span>{expanded ? "Collapse flow" : "Inspect pipeline"}</span>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        FlawCheck decouples math from reasoning: deterministic calculations strictly govern engineering limits, while NVIDIA Nemotron-3.5 on Nebius Token Factory explains damage morphology under strict AST linter guardrails.
      </p>

      {expanded && (
        <div className="mt-5 flex flex-col gap-5">
          {/* Flow step chain */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
            {PIPELINE_NODES.map((node) => {
              const Icon = node.icon;
              const isSelected = selectedNode.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNode(node)}
                  className={`group relative flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      0{node.step}
                    </span>
                    <span className={`size-2 rounded-full ${isSelected ? "bg-primary animate-pulse" : "bg-muted"}`} />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Icon className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                    <span className="text-xs font-semibold leading-tight">{node.label}</span>
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground">{node.sublabel}</span>
                  <span
                    className={`mt-2 inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${node.badgeColor}`}
                  >
                    {node.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active node detail drawer */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                <span className="font-semibold text-foreground text-sm">
                  {selectedNode.label}: {selectedNode.sublabel}
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Verified Module: {selectedNode.codePath}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Standards & Platform
                </span>
                <span className="mt-0.5 block font-medium text-foreground">
                  {selectedNode.standards}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Engineering Invariant
                </span>
                <span className="mt-0.5 block font-medium text-primary">
                  {selectedNode.invariant}
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-muted-foreground leading-relaxed">
              {selectedNode.description}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
