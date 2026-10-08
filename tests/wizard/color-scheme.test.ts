/**
 * Dropdown legibility contract — native <select> popups must render in the
 * dark color scheme. The app force-darkens via data-appearance="dark" on
 * <html> (app/layout.tsx), but native select popups are themed by the CSS
 * `color-scheme` property, not by the token palette. Without
 * `color-scheme: dark` the browser renders the option list with a white
 * background while the (near-white) token foreground inherits into the
 * option elements → white-on-white, illegible text.
 *
 * The contract: the dark token block must set color-scheme: dark (and the
 * light block color-scheme: light) so every native control — select popups,
 * date pickers, scrollbars — follows the active appearance.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

describe("native control color-scheme contract", () => {
  // The FIRST '[data-appearance="dark"]' occurrence is the @custom-variant
  // (line ~14); the token BLOCK starts at its '[data-appearance="dark"] {'
  // selector. Slice on ' { ' to find the real block.
  const blockStart = css.indexOf('[data-appearance="dark"] {');

  it("declares color-scheme: dark for the dark appearance (select popups stay legible)", () => {
    const darkBlock = css.slice(blockStart);
    expect(darkBlock).toMatch(/color-scheme:\s*dark/);
  });

  it("declares color-scheme: light for the light/root appearance", () => {
    const lightBlock = css.slice(0, blockStart);
    expect(lightBlock).toMatch(/color-scheme:\s*light/);
  });
});
