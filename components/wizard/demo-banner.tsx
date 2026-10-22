/**
 * Demo provenance banner (UI-21, 06-02 UI-6.23): scope-aware — the copy
 * distinguishes the committed WBT-S6 subset from the full-register scale
 * demo; both retain "(sample data)". Exported pure for the node test-suite.
 *
 * Lives in components/ (not app/page.tsx) so the page entry exports only
 * route-level symbols — Next.js 16 route validators reject extra exports
 * from app/page.tsx during type-checking.
 */
export function DemoBanner({ scope }: { scope: "subset" | "full" }) {
  const copy =
    scope === "full"
      ? "Demo scenario loaded — Zenodo record 16780668 full register (sample data)"
      : "Demo scenario loaded — Zenodo record 16780668 subset (sample data)";
  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary"
    >
      {copy}
    </div>
  );
}
