/**
 * Unit conversion — mm is canonical inside the engine (ut-criteria.json
 * unit_system: "mm (millimeters) for all thickness quantities; years for all
 * time quantities").
 *
 * The inch/mil definitions are exact by IEEE representation of these decimal
 * constants (research ING-05 row): 1 in = 25.4 mm and 1 mil = 0.0254 mm.
 * These are unit definitions, not acceptance limits — they are not criteria
 * values and are intentionally exact literals here.
 */
export type Unit = "mm" | "in" | "mils";

export function toMm(value: number, unit: Unit): number {
  switch (unit) {
    case "mm":
      return value;
    case "in":
      return value * 25.4;
    case "mils":
      return value * 0.0254;
  }
}
