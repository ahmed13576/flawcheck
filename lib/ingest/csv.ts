/**
 * RFC 4180 quote-aware CSV tokenizer (research R3 — spec verified verbatim):
 * - Fields containing commas/quotes/line breaks are double-quoted.
 * - A double-quote inside a quoted field is escaped by doubling.
 * - Quoted fields may contain CR/LF/commas.
 * - The last record may or may not have a trailing line break.
 * - Records may use CRLF, LF, or lone CR separators.
 *
 * Security guard (threat T-02-02, prototype pollution): row cells built from
 * parsed headers use null-prototype objects (buildCells) so header text can
 * never reach Object.prototype.
 *
 * Two numbering spaces (research R2): `errors` carry physical file `line`
 * numbers (parse errors); semantic row issues are collected elsewhere with
 * 1-based data-row indexes — the two spaces never mix.
 */
export type Delimiter = "," | ";" | "\t";

export interface CsvParseError {
  /** Physical file line (1-based) the problem starts on. */
  line: number;
  problem: string;
}

export interface TokenizeResult {
  /**
   * All records including the header row at index 0. True blank lines (a
   * single unquoted empty field) are skipped; records with delimiter-
   * separated empty fields (',,') are REAL records and are kept — the
   * validation layer reports their missing values (WR-07).
   */
  records: string[][];
  errors: CsvParseError[];
  delimiter: Delimiter;
}

/**
 * Delimiter sniff (R3 item 6): count `,` vs `;` vs `\t` outside quotes on the
 * first record line; pick the max; default comma. Gauge exports vary.
 */
export function sniffDelimiter(input: string): Delimiter {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (ch === "\n" || ch === "\r")) {
      break; // header line ends
    } else if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) {
      counts[ch as Delimiter] += 1;
    }
  }
  let best: Delimiter = ",";
  let bestCount = 0;
  (Object.keys(counts) as Delimiter[]).forEach((d) => {
    if (counts[d] > bestCount) {
      best = d;
      bestCount = counts[d];
    }
  });
  return best;
}

/**
 * Quote-aware state machine (IN_FIELD / IN_QUOTED). Strips the UTF-8 BOM,
 * handles doubled-quote escapes, CRLF/LF/CR record separators outside quotes,
 * trailing record without newline, and skips only true blank lines (a trailing
 * newline must not produce a phantom row — Pitfall 5; a ',,' record is data
 * and is kept — WR-07). Unquoted fields are trimmed; quoted fields are
 * preserved byte-for-byte.
 */
export function tokenize(
  input: string,
  delimiter: Delimiter = sniffDelimiter(input),
): TokenizeResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  const errors: CsvParseError[] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let quotedField = false;
  let line = 1;
  let fieldStartLine = 1;

  const pushField = () => {
    record.push(quotedField ? field : field.trim());
    field = "";
    quotedField = false;
  };
  const pushRecord = () => {
    // WR-07: capture the last field's quoted flag before pushField resets it —
    // a quoted empty field ('""') is an EXPLICIT record, not a blank line.
    const lastFieldQuoted = quotedField;
    pushField();
    // Skip only TRUE blank lines: a record consisting of a single unquoted
    // empty field (a bare newline, a whitespace-only line, the trailing
    // newline) — never a phantom row (Pitfall 5). A record carrying
    // delimiter-separated empty fields (',,') is a real RFC 4180 record: it
    // flows to the validation layer (missing-value errors) and the 1-based
    // data-row numbering stays aligned with what the user sees in the file.
    // Ragged records keep their cells either way — no silent truncation.
    if (record.length > 1 || record[0] !== "" || lastFieldQuoted) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // 2DQUOTE escape
          i++;
        } else {
          inQuotes = false; // closing quote — peek, don't consume CRLF
        }
      } else {
        field += ch;
        if (ch === "\n") line++;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
      quotedField = true;
      fieldStartLine = line;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line++;
      pushRecord();
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    errors.push({ line: fieldStartLine, problem: "unclosed quoted field" });
  } else if (field !== "" || record.length > 0) {
    pushRecord(); // last record may lack a line break (RFC 4180 §2)
  }
  return { records, errors, delimiter };
}

/**
 * Build one row's cells keyed by header text as a null-prototype object —
 * parsed header text (attacker-controlled) can never pollute
 * Object.prototype (T-02-02 mitigation).
 */
export function buildCells(
  headers: string[],
  record: string[],
): Record<string, string> {
  const cells = Object.create(null) as Record<string, string>;
  headers.forEach((header, i) => {
    cells[header] = record[i] ?? "";
  });
  return cells;
}
