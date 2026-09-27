/**
 * Builder-authored 6-row tracer fixture (Plan 02-01): 3 CMLs, 2 campaigns
 * each (2015-01-15 / 2025-01-15 = 3653 UTC days per G13), constant 20 mm
 * original scantling. Headers carry the canonical alias names so auto-guess
 * maps every column and the `_mm` suffix drives thickness-unit auto-guess.
 *
 * Expected outcomes (golden pipeline):
 * - CML A01 (9.5 -> 9.2): ACCEPT, CR_LT = 0.3 / 10.001369 = 0.029996 mm/yr
 * - CML B02 (2.0 -> 2.0): FAIL (reject band; zero rate -> insufficient history)
 * - CML C03 (2.637536 -> 2.637536): RE-CHECK (6-dp canonicalization makes the
 *   equality with t_required exact — G8 row-1 semantics)
 */
export const tracerSampleCsv = `Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date
A01-2015,A01,N-3,20,9.5,2015-01-15
A01-2025,A01,N-3,20,9.2,2025-01-15
B02-2015,B02,S-1,20,2.0,2015-01-15
B02-2025,B02,S-1,20,2.0,2025-01-15
C03-2015,C03,E-7,20,2.637536,2015-01-15
C03-2025,C03,E-7,20,2.637536,2025-01-15
`;
