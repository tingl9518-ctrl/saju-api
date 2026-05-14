/**
 * reference/jieqi-reference*.csv 공통 파서.
 * 헤더: calendarYear(또는 year), jieId, instantKst, source, confidence, verifiedBy, note — note 이후는 무시 가능.
 */

/**
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * @param {string} text
 * @returns {Array<{
 *   calendarYear: number;
 *   jieId: string;
 *   instantKst: string;
 *   source: string;
 *   confidence: string;
 *   verifiedBy: string;
 *   note: string;
 * }>}
 */
export function parseJieqiReferenceRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names) => {
    for (const n of names) {
      const i = header.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const cy = idx(["calendaryear", "year"]);
  const ji = idx(["jieid"]);
  const ins = idx(["instantkst"]);
  const src = idx(["source"]);
  const conf = idx(["confidence"]);
  const ver = idx(["verifiedby"]);
  const note = idx(["note"]);
  if (cy < 0 || ji < 0 || ins < 0) {
    throw new Error(
      "CSV 헤더에 calendarYear(또는 year), jieId, instantKst 가 필요합니다.",
    );
  }
  const rows = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = parseCsvLine(lines[n]);
    const need = Math.max(cy, ji, ins) + 1;
    if (cells.length < need) continue;
    const pick = (i) => (i >= 0 && cells[i] !== undefined ? String(cells[i]).trim() : "");
    rows.push({
      calendarYear: Number(cells[cy]),
      jieId: pick(ji),
      instantKst: pick(ins),
      source: pick(src),
      confidence: pick(conf),
      verifiedBy: pick(ver),
      note: pick(note),
    });
  }
  return rows;
}
