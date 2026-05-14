/**
 * reference CSV와 app/api/saju/data/solar-terms/bundle.json의 절입 시각을 비교한다.
 * 현재는 입춘(ipchun|lichun) 행만 처리한다.
 *
 * 사용:
 *   node scripts/compare-jieqi-reference.mjs
 *   node scripts/compare-jieqi-reference.mjs path/to/reference.csv
 *
 * CSV 스키마: calendarYear(또는 year), jieId, instantKst, source, confidence, verifiedBy, note
 * - instantKst: ISO8601 with Asia/Seoul offset (예: 1997-02-04T05:00:00+09:00)
 * - 빈 instantKst 행은 건너뜀
 *
 * deltaMin_r-b = (reference KST instant ms − bundle KST instant ms) / 60000
 *   음수면 번들 입춘이 레퍼런스보다 늦은 시각(예: 번들이 더 늦게 입춘).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJieqiReferenceRows } from "./lib/parse-jieqi-reference-csv.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const DEFAULT_REF = join(ROOT, "reference", "jieqi-reference.sample.csv");
const BUNDLE_PATH = join(
  ROOT,
  "app",
  "api",
  "saju",
  "data",
  "solar-terms",
  "bundle.json",
);

/** 입춘 — 레퍼런스 id */
const LICHUN_IDS = new Set(["ipchun", "lichun", "입춘"]);

/**
 * @param {number} ms
 * @returns {string}
 */
function formatKstIso(ms) {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const m = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}+09:00`;
}

/**
 * @param {string} s
 */
function padField(s, w) {
  const t = String(s);
  return t.length >= w ? t.slice(0, w) : t + " ".repeat(w - t.length);
}

const absRef = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : DEFAULT_REF;

if (!existsSync(absRef)) {
  console.error("레퍼런스 파일이 없습니다:", absRef);
  process.exit(1);
}
if (!existsSync(BUNDLE_PATH)) {
  console.error("bundle.json 이 없습니다:", BUNDLE_PATH);
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
const lichunMap = bundle.lichunUtcByCalendarYear;
if (!lichunMap || typeof lichunMap !== "object") {
  console.error("bundle.json에 lichunUtcByCalendarYear 이 없습니다.");
  process.exit(1);
}

const csvText = readFileSync(absRef, "utf8");
const rows = parseJieqiReferenceRows(csvText);

const outRows = [];
for (const r of rows) {
  if (!LICHUN_IDS.has(r.jieId.toLowerCase())) {
    continue;
  }
  if (!Number.isFinite(r.calendarYear)) {
    continue;
  }
  if (!r.instantKst) {
    continue;
  }

  const key = String(r.calendarYear);
  const bundleUtcIso = lichunMap[key];
  if (!bundleUtcIso) {
    outRows.push({
      year: r.calendarYear,
      jieId: r.jieId,
      bundleKst: "(없음)",
      referenceKst: r.instantKst,
      deltaMinutes: "",
      err: `bundle에 입춘 없음: ${key}`,
    });
    continue;
  }

  const bundleMs = Date.parse(bundleUtcIso);
  const refMs = Date.parse(r.instantKst);
  if (Number.isNaN(bundleMs) || Number.isNaN(refMs)) {
    outRows.push({
      year: r.calendarYear,
      jieId: r.jieId,
      bundleKst: bundleUtcIso,
      referenceKst: r.instantKst,
      deltaMinutes: "",
      err: "날짜 파싱 실패",
    });
    continue;
  }

  const bundleKst = formatKstIso(bundleMs);
  const deltaMinutes = (refMs - bundleMs) / 60000;
  outRows.push({
    year: r.calendarYear,
    jieId: r.jieId,
    bundleKst,
    referenceKst: r.instantKst,
    deltaMinutes: Number(deltaMinutes.toFixed(3)),
    err: "",
  });
}

if (outRows.length === 0) {
  console.log(
    "비교할 행이 없습니다. instantKst가 채워진 ipchun|lichun 행을 CSV에 추가하세요.",
  );
  console.log("레퍼런스:", absRef);
  process.exit(0);
}

const WY = 6;
const WJ = 8;
const WB = 30;
const WR = 30;
const WD = 14;

console.log(
  `${padField("year", WY)} ${padField("jieId", WJ)} ${padField("bundleKst", WB)} ${padField("referenceKst", WR)} ${padField("deltaMin_r-b", WD)}`,
);
for (const o of outRows) {
  const line = `${padField(o.year, WY)} ${padField(o.jieId, WJ)} ${padField(o.bundleKst, WB)} ${padField(o.referenceKst, WR)} ${padField(String(o.deltaMinutes), WD)}`;
  console.log(o.err ? `${line}  ERR: ${o.err}` : line);
}
