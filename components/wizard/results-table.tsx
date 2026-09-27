"use client";

/**
 * Results table — Screen 3 primary region (UI-13/14/16..19, UI-24). Real
 * table, th scope=col, 50-row pagination with the 'Showing 1–50 of 4,912'
 * caption. Ten locked columns in exact order; numeric cells font-mono
 * tabular-nums whitespace-nowrap; identifier cells truncate with title; null
 * maps to '—' (+ 'insufficient corrosion history' sub-text) — the strings
 * Infinity/NaN can never render (lib/wizard/format degrades non-finite to
 * '—'). G14: immediate-inspection readings render the fail-tone 'Immediate
 * inspection required' text — never a date or negative interval.
 */
import { useMemo, useState } from "react";
import type { ReadingResult, ReadingFlag } from "@/lib/ingest/session";
import {
  formatFixed,
  formatCaption,
  nextInspectionCell,
  rlCell,
} from "@/lib/wizard/format";
import { VerdictChip, FlagChip } from "@/components/wizard/verdict-chip";
import { FlagDetailRow } from "@/components/wizard/flag-detail-row";

export const RESULTS_PAGE_SIZE = 50;

const TOGGLEABLE_FLAGS: ReadingFlag[] = ["measurement_inconsistency", "outlier"];

const NUMERIC_CELL = "border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap";

function FlagChipButton({
  reading,
  flag,
  expanded,
  onToggle,
}: {
  reading: ReadingResult;
  flag: ReadingFlag;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!TOGGLEABLE_FLAGS.includes(flag)) {
    return <FlagChip flag={flag} />;
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`detail-${reading.readingId}-${flag}`}
      onClick={onToggle}
      className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
    >
      <FlagChip flag={flag} />
    </button>
  );
}

export function ResultsTable({
  readings,
  page,
  onPageChange,
}: {
  readings: ReadingResult[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pageCount = Math.max(1, Math.ceil(readings.length / RESULTS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * RESULTS_PAGE_SIZE;
    return readings.slice(start, start + RESULTS_PAGE_SIZE);
  }, [readings, safePage]);

  const start = (safePage - 1) * RESULTS_PAGE_SIZE + 1;
  const end = Math.min(safePage * RESULTS_PAGE_SIZE, readings.length);
  const colCount = 10;

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section aria-label="CML results" className="rounded-lg border border-[#262626] bg-[#171717] p-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="px-1 pb-2 text-left text-xs text-[#a3a3a3]">
            {formatCaption(start, end, readings.length)}
          </caption>
          <thead>
            <tr className="bg-[#171717] text-left">
              <th scope="col" className="border border-[#262626] px-3 py-2">CML / Location</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">t-actual (mm)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">t-required (mm)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">CR_LT (mm/yr)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">CR_ST (mm/yr)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">CR governing (mm/yr)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">RL (yr)</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">Next inspection</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">Flags</th>
              <th scope="col" className="border border-[#262626] px-3 py-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((reading) => {
              const rl = rlCell(reading);
              const next = nextInspectionCell(reading);
              return (
                [
                  <tr key={reading.readingId} className="bg-[#0a0a0a]">
                    <td className="border border-[#262626] px-3 py-2">
                      <span
                        className="block max-w-[14rem] truncate"
                        title={reading.cml ?? reading.location}
                      >
                        {reading.cml ?? reading.location}
                      </span>
                    </td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.tActualMm, 2)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.tRequiredMm, 2)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.crLtMmYr, 3)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.crStMmYr, 3)}</td>
                    <td className={`${NUMERIC_CELL} font-semibold`}>
                      {formatFixed(reading.crGoverningMmYr, 3)}
                    </td>
                    <td className={NUMERIC_CELL}>
                      {rl.kind === "dash" ? (
                        <>
                          <span>—</span>
                          {rl.subText && (
                            <span className="block text-xs font-normal text-[#a3a3a3]">
                              {rl.subText}
                            </span>
                          )}
                        </>
                      ) : (
                        rl.text
                      )}
                    </td>
                    <td className="border border-[#262626] px-3 py-2 whitespace-nowrap">
                      {next.kind === "immediate" ? (
                        <span className="font-semibold text-[#f87171]">
                          Immediate inspection required
                        </span>
                      ) : next.kind === "date" ? (
                        <>
                          <span className="font-mono tabular-nums">{next.date}</span>
                          <span className="ml-1 text-xs text-[#a3a3a3]">
                            {`(interval ${next.intervalYears.toFixed(1)} yr)`}
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="border border-[#262626] px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {reading.flags.map((flag) => (
                          <FlagChipButton
                            key={flag}
                            reading={reading}
                            flag={flag}
                            expanded={Boolean(expanded[`${reading.readingId}-${flag}`])}
                            onToggle={() => toggle(`${reading.readingId}-${flag}`)}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="border border-[#262626] px-3 py-2">
                      <VerdictChip verdict={reading.verdict} />
                    </td>
                  </tr>,
                  ...reading.flags
                    .filter(
                      (flag) =>
                        TOGGLEABLE_FLAGS.includes(flag) &&
                        expanded[`${reading.readingId}-${flag}`],
                    )
                    .map((flag) => (
                      <FlagDetailRow
                        key={`${reading.readingId}-${flag}`}
                        reading={reading}
                        flag={flag}
                        colSpan={colCount}
                      />
                    )),
                ]
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded border border-[#262626] px-3 py-1.5 font-semibold hover:border-gray-500 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-[#a3a3a3]">
          Page {safePage.toLocaleString("en-US")} of {pageCount.toLocaleString("en-US")}
        </span>
        <button
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded border border-[#262626] px-3 py-1.5 font-semibold hover:border-gray-500 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
