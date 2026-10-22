/**
 * Demo provenance banner (UI-21, 06-02 UI-6.23): scope-aware — the copy
 * distinguishes the committed WBT-S6 subset from the full-register scale
 * demo; both retain "(sample data)". Exported pure for the node test-suite.
 * Lives outside app/page.tsx because Next.js forbids extra named exports
 * from page modules (next typegen's OmitWithTag check fails otherwise).
 */
export function DemoBanner({ scope }: { scope: "subset" | "full" }) {
  const copy =
    scope === "full"
      ? "Demo scenario loaded — Zenodo record 16780668 full register (sample data)"
      : "Demo scenario loaded — Zenodo record 16780668 subset (sample data)";
  return (
    <div
      role="status"
      className="mb-4 rounded-none border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
    >
      {copy}
    </div>
  );
}
