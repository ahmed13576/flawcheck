import { describe, it, expect } from "vitest";
import { autoGuess, csvThicknessUnitFromHeader, normalizeHeader } from "@/lib/ingest/map";

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
  it("maps all five targets on the canonical six-column register", () => {
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
    expect(mapping.tInitial).toBe("Original_Scantling_mm");
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

  it("maps date and wide-format aliases", () => {
    expect(autoGuess(["Date"]).measurementDate).toBe("Date");
    expect(autoGuess(["InspectionDate"]).measurementDate).toBe("InspectionDate");
    expect(autoGuess(["Original_Scantling"]).tInitial).toBe("Original_Scantling");
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
