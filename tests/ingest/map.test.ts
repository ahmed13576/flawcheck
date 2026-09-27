import { describe, it, expect } from "vitest";
import {
  autoGuess,
  csvThicknessUnitFromHeader,
  isNominalScantlingHeader,
  normalizeHeader,
} from "@/lib/ingest/map";

describe("map — normalizeHeader", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeHeader("Reading_ID")).toBe("readingid");
    expect(normalizeHeader("  Measured-Thickness (mm) ")).toBe("measuredthicknessmm");
  });
  it("a BOM-prefixed header normalizes cleanly", () => {
    expect(normalizeHeader("\uFEFFTank")).toBe("tank");
  });
});

describe("map — autoGuess against the UI-SPEC alias table", () => {
  it("maps the measured targets on the canonical six-column register (CR-02: scantling is NOT t-initial)", () => {
    const mapping = autoGuess([
      "Reading_ID",
      "Tank",
      "Grid_Position",
      "Original_Scantling_mm",
      "Measured_Thickness_mm",
      "Measurement_Date",
    ]);
    expect(mapping.readingId).toBe("Reading_ID");
    expect(mapping.tank).toBe("Tank");
    // CR-02: Original_Scantling_mm is a constant nominal design scantling, not
    // a measured t-initial — auto-guess must never bind it (the demo/tracer
    // builders null this exact mapping; the upload path now mirrors them).
    expect(mapping.tInitial).toBeNull();
    expect(mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(mapping.measurementDate).toBe("Measurement_Date");
    expect(mapping.tPrevious).toBeNull();
  });

  it("respects the alias order for each field (id/pointid/cml/gridposition for Reading ID)", () => {
    expect(autoGuess(["ID", "Date"]).readingId).toBe("ID");
    expect(autoGuess(["PointID", "Thickness"]).readingId).toBe("PointID");
    expect(autoGuess(["Grid_Position", "Tank"]).readingId).toBe("Grid_Position");
    expect(autoGuess(["Tank"]).tank).toBe("Tank");
    expect(autoGuess(["Location"]).tank).toBe("Location");
    expect(autoGuess(["Component"]).tank).toBe("Component");
    expect(autoGuess(["CML"]).readingId).toBe("CML");
  });

  it("maps thickness aliases in order", () => {
    expect(autoGuess(["MeasuredThickness"]).measuredThickness).toBe("MeasuredThickness");
    expect(autoGuess(["Thickness"]).measuredThickness).toBe("Thickness");
    expect(autoGuess(["Wall Thickness"]).measuredThickness).toBe("Wall Thickness");
    expect(autoGuess(["TActual"]).measuredThickness).toBe("TActual");
  });

  it("maps date and wide-format aliases (CR-02: never a scantling alias)", () => {
    expect(autoGuess(["Date"]).measurementDate).toBe("Date");
    expect(autoGuess(["InspectionDate"]).measurementDate).toBe("InspectionDate");
    // CR-02: both scantling spellings are excluded from auto-guess.
    expect(autoGuess(["Original_Scantling"]).tInitial).toBeNull();
    expect(autoGuess(["Original Scantling (mm)"]).tInitial).toBeNull();
    expect(autoGuess(["InitialThickness"]).tInitial).toBe("InitialThickness");
    expect(autoGuess(["TInitial"]).tInitial).toBe("TInitial");
    expect(autoGuess(["PreviousThickness"]).tPrevious).toBe("PreviousThickness");
    expect(autoGuess(["TPrevious"]).tPrevious).toBe("TPrevious");
    expect(autoGuess(["LastThickness"]).tPrevious).toBe("LastThickness");
  });

  it("unknown headers map to null", () => {
    const mapping = autoGuess(["Foo", "Bar"]);
    expect(mapping).toEqual({
      readingId: null,
      measuredThickness: null,
      measurementDate: null,
      tInitial: null,
      tPrevious: null,
      tank: null,
    });
  });
});

describe("map — CR-02 nominal-scantling detection (explicit mappings are honored but warned)", () => {
  it("isNominalScantlingHeader matches any scantling-named column", () => {
    expect(isNominalScantlingHeader("Original_Scantling_mm")).toBe(true);
    expect(isNominalScantlingHeader("original scantling")).toBe(true);
    expect(isNominalScantlingHeader("Design Scantling (20)")).toBe(true);
    expect(isNominalScantlingHeader("Measured_Thickness_mm")).toBe(false);
    expect(isNominalScantlingHeader("InitialThickness")).toBe(false);
    expect(isNominalScantlingHeader(null)).toBe(false);
  });

  it("auto-guess keeps genuinely measured t-initial aliases selectable by the user", () => {
    // The user can still explicitly map a measured t-initial column — only the
    // constant-nominal scantling aliases are excluded from the GUESS.
    const mapping = autoGuess(["InitialThickness", "Measured_Thickness_mm", "Date"]);
    expect(mapping.tInitial).toBe("InitialThickness");
  });
});

describe("map — CSV thickness unit auto-guess from header suffix", () => {
  it("_mm -> mm, _in -> in, _mils -> mils", () => {
    expect(csvThicknessUnitFromHeader("Measured_Thickness_mm")).toBe("mm");
    expect(csvThicknessUnitFromHeader("Measured_Thickness_in")).toBe("in");
    expect(csvThicknessUnitFromHeader("Measured_Thickness_mils")).toBe("mils");
  });
  it("defaults to mm when no suffix", () => {
    expect(csvThicknessUnitFromHeader("Thickness")).toBe("mm");
    expect(csvThicknessUnitFromHeader(null)).toBe("mm");
  });
});
