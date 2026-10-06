# FlawCheck Demo Video Script (≤3 minutes)

> Target: 2:45 runtime. Record at 1920×1080. Narrate clearly. Show the model badges in the pipeline status bar and the reasoning pane.

---

## 0:00 – 0:30 — The problem (30 s)

**Screen:** Static slide or the landing page.

> "NDT inspectors spend hours turning raw ultrasonic thickness readings into code-compliant reports — manually checking every measurement against ASME B31.3, API 570, and API 574. FlawCheck does it in seconds, with every number computed in code and every citation locked to a verified allowlist."

**Action:** Show the landing page briefly.

---

## 0:30 – 1:00 — Load demo + evaluate (30 s)

**Screen:** Landing page → Screen 2 (Review & Metadata).

> "I'll load the demo scenario — 4,912 real ultrasonic readings from 12 ballast tank locations, from a public Zenodo dataset. The column mapping is auto-guessed, the metadata is pre-filled, and I'll run the evaluation."

**Action:** Click "Explore a sample inspection" → Screen 2 appears with the parsed table → click "Run evaluation".

---

## 1:00 – 2:00 — Reasoning pane: the core value (60 s)

**Screen:** Screen 3 (Results) — summary strip, pipeline status bar, results table.

> "4,912 readings evaluated — 301 accepted, 538 need re-checking, 4,073 failed. Every verdict shows its reasoning chain: the measured inputs, the governing clause, the limit, and the verdict. The narrative is streamed by Nemotron Super 120B — notice it never computes a number; TypeScript already did. The citations resolve through a locked allowlist — a fabricated clause ID renders blank with an audit stamp."

**Action:** Scroll to a RE-CHECK row → click "View reasoning" → the reasoning pane opens showing the chain + streaming narrative + model badge (`nvidia/nemotron-3-super-120b-a12b · tokens … · … s · —`).

**Show:** The pipeline status bar with the extraction badge (`Nemotron-3_5-Lightning · tokens 3,857 · 13.9 s · —`).

**Also show:** The PT/MT triage card with its clause citation, and the "Immediate inspection required" flag on a FAIL row.

---

## 2:00 – 2:30 — PDF report (30 s)

**Screen:** Click "Open report preview" → /report page.

> "The full report carries the same data — component context, CML measurements, clause-cited conclusions, and the complete audit trail with input hashes and model versions. I'll sign it off and download the PDF."

**Action:** Fill the four sign-off fields → the chip flips to "SIGNED OFF — Mohammed Ahmed" → click "Download PDF" → the PDF opens showing the same content.

---

## 2:30 – 3:00 — Architecture + credit (30 s)

**Screen:** Back to the landing page or a static architecture slide.

> "FlawCheck runs on Nebius Token Factory — Nemotron Super 120B for acceptance reasoning, Lightning for extraction, with a deterministic TypeScript fallback that works even when the LLM is offline. Every calculation is in pure TypeScript; the AI never does arithmetic. The result is a report an inspector can defend. Thank you."

**End frame:** GitHub repo URL + "Built with Nebius Token Factory + NVIDIA Nemotron"

---

## Recording checklist

- [ ] Close all other tabs; use an incognito window for the cold-start proof
- [ ] Load the demo BEFORE recording (cached, zero network delay)
- [ ] Show the pipeline status bar model badges clearly (zoom if needed)
- [ ] Click "View reasoning" and wait for the stream to finish before narrating
- [ ] Download the PDF and open it — show the clause citations
- [ ] Mention "Nebius Token Factory" and "NVIDIA Nemotron" by name
- [ ] Total: ≤ 3 minutes; the working solution is visible for ≥ 1 minute
