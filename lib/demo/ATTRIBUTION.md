# Data Attribution — Demo Fixture

**Dataset:** RBM PoF Model and Supporting Data for Risk-Based and Condition-Based Crude-Oil
Tank Inspection Optimisation

**Credit (CC BY 4.0, verbatim requirement):**

> Pudar, A. (2025). *RBM PoF Model and Supporting Data for Risk-Based and Condition-Based
> Crude-Oil Tank Inspection Optimisation*. Zenodo. https://doi.org/10.5281/zenodo.16780668
> — CC BY 4.0. Subset used: Appendix A UT thickness register (4,912 readings). FlawCheck
> labels this data "sample data" in the UI.

## Provenance

- **Source file:** `data/Appendix_A_UT_register.csv` inside `RBM_PoF_Model.zip`
  (Zenodo record 16780668, file 169,298 bytes).
- **Downloaded:** 2026-09-27; md5 verified before extraction:
  `4735bbeca392636f9b2ba91b2c2b42fc` (matches the research-verified checksum — a mismatch
  halts acquisition).
- **Subset:** Appendix A only. No other appendix (B / D / E / model outputs) is committed.
  The downloaded zip itself is never committed (scratch/ is gitignored).

## Transformations applied (verbatim otherwise)

1. **Date normalization only:** source dates are `DD/MM/YYYY`; the fixture stores them as
   ISO `YYYY-MM-DD` so the strict-ISO engine (`lib/calc` `parseIsoUtc`, research Pitfall 1)
   consumes the real data without a permissive parser. All dates verified valid before
   conversion; campaign years 2015–2025 (11 campaigns).
2. **Minified JSON array** of row objects with exactly the six source columns:
   `Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm,
   Measurement_Date`. Measured thickness values are verbatim (observed range
   18.88–20.0 mm; original scantling constant 20 mm; 12 tanks WBT-P1..P6 / WBT-S1..S6).

## Licensing

CC BY 4.0 requires attribution and does not restrict the transformations above (share /
adapt permitted with credit). The demo UI surfaces this provenance via the persistent
banner: `Demo scenario loaded — Zenodo record 16780668 subset (sample data)`.
