/**
 * 1900~2100 양력 연도별 입춘: bundle.json vs reference/jieqi-reference.csv
 * 요약·분류 리포트를 reports/ 에 기록한다.
 *
 * 환경변수:
 *   JIEQI_BUNDLE_PATH — 기본: app/api/saju/data/solar-terms/bundle.json
 *   JIEQI_REF_CSV — 기본: reference/jieqi-reference.csv
 *   JIEQI_EXACT_MAX_ABS_SEC — 기본 1 (exact 판정 상한 초)
 *   JIEQI_TOLERANCE_SEC — 기본 300 (within_tolerance 상한 초)
 *   JIEQI_FAIL_MAX_ABS_SEC — 기본 300, 초과 시 exit 1
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJieqiReferenceRows } from "./lib/parse-jieqi-reference-csv.mjs";
import { YEAR_MIN, YEAR_MAX } from "./lib/jieqi-grid.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const LICHUN_IDS = new Set(["ipchun", "lichun", "입춘"]);

const EXACT_MAX_ABS_SEC = Number(process.env.JIEQI_EXACT_MAX_ABS_SEC ?? 1);
const TOLERANCE_SEC = Number(process.env.JIEQI_TOLERANCE_SEC ?? 300);
const FAIL_MAX_ABS_SEC = Number(process.env.JIEQI_FAIL_MAX_ABS_SEC ?? 300);

const BUNDLE_PATH = process.env.JIEQI_BUNDLE_PATH
  ? resolve(process.env.JIEQI_BUNDLE_PATH)
  : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.json");
const REF_CSV = process.env.JIEQI_REF_CSV
  ? resolve(process.env.JIEQI_REF_CSV)
  : join(ROOT, "reference", "jieqi-reference.csv");
const OUT_DIR = join(ROOT, "reports");
const OUT_JSON = join(OUT_DIR, "jieqi-lichun-report.json");
const OUT_TXT = join(OUT_DIR, "jieqi-lichun-report.txt");

function classify(absSec) {
  if (absSec <= EXACT_MAX_ABS_SEC) return "exact";
  if (absSec <= TOLERANCE_SEC) return "within_tolerance";
  return "outlier";
}

function percentileAbs(sortedAbs, p) {
  if (sortedAbs.length === 0) return null;
  if (sortedAbs.length === 1) return sortedAbs[0];
  const idx = Math.min(
    sortedAbs.length - 1,
    Math.ceil(p * sortedAbs.length) - 1,
  );
  return sortedAbs[idx];
}

if (!existsSync(BUNDLE_PATH)) {
  console.error("bundle 없음:", BUNDLE_PATH);
  process.exit(1);
}
if (!existsSync(REF_CSV)) {
  console.error("reference CSV 없음:", REF_CSV);
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
const lichunMap = bundle.lichunUtcByCalendarYear;
if (!lichunMap || typeof lichunMap !== "object") {
  console.error("lichunUtcByCalendarYear 없음");
  process.exit(1);
}

const csvText = readFileSync(REF_CSV, "utf8");
const parsed = parseJieqiReferenceRows(csvText);
/** @type {Map<number, (typeof parsed)[0]>} */
const refByYear = new Map();
for (const r of parsed) {
  if (!LICHUN_IDS.has(r.jieId.toLowerCase())) continue;
  if (!Number.isFinite(r.calendarYear)) continue;
  if (!r.instantKst) continue;
  refByYear.set(r.calendarYear, r);
}

const rows = [];
const absForP95 = [];

let missingReference = 0;
let missingBundle = 0;
let countExact = 0;
let countWithin = 0;
let countOutlier = 0;

for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
  const ref = refByYear.get(y);
  const bundleIso = lichunMap[String(y)];
  const base = {
    calendarYear: y,
    bundleUtcIso: bundleIso ?? null,
    referenceKst: ref?.instantKst ?? null,
    source: ref?.source ?? null,
    confidence: ref?.confidence ?? null,
    verifiedBy: ref?.verifiedBy ?? null,
    note: ref?.note ?? null,
    deltaSecRefMinusBundle: null,
    absDeltaSec: null,
    classification: null,
  };

  if (!bundleIso) {
    rows.push({ ...base, classification: "missing_bundle" });
    missingBundle++;
    continue;
  }
  if (!ref?.instantKst) {
    rows.push({ ...base, classification: "missing_reference" });
    missingReference++;
    continue;
  }

  const bundleMs = Date.parse(bundleIso);
  const refMs = Date.parse(ref.instantKst);
  if (Number.isNaN(bundleMs) || Number.isNaN(refMs)) {
    rows.push({
      ...base,
      classification: "parse_error",
    });
    continue;
  }

  const deltaSec = Math.round((refMs - bundleMs) / 1000);
  const absSec = Math.abs(deltaSec);
  const classification = classify(absSec);
  absForP95.push(absSec);
  if (classification === "exact") countExact++;
  else if (classification === "within_tolerance") countWithin++;
  else countOutlier++;

  rows.push({
    ...base,
    deltaSecRefMinusBundle: deltaSec,
    absDeltaSec: absSec,
    classification,
  });
}

absForP95.sort((a, b) => a - b);
const maxAbsDeltaSec =
  absForP95.length === 0 ? null : absForP95[absForP95.length - 1];
const p95AbsDeltaSec = percentileAbs(absForP95, 0.95);

const failOutliers = countOutlier > 0;
const failMax =
  maxAbsDeltaSec !== null && maxAbsDeltaSec > FAIL_MAX_ABS_SEC;
const fail = failOutliers || failMax;
const failReason = fail
  ? [
      failOutliers ? `outlier_rows=${countOutlier}` : "",
      failMax ? `maxAbsDeltaSec=${maxAbsDeltaSec}>${FAIL_MAX_ABS_SEC}` : "",
    ]
      .filter(Boolean)
      .join("; ")
  : "";

const report = {
  generatedAt: new Date().toISOString(),
  config: {
    yearRange: [YEAR_MIN, YEAR_MAX],
    exactMaxAbsSec: EXACT_MAX_ABS_SEC,
    toleranceSec: TOLERANCE_SEC,
    failMaxAbsSec: FAIL_MAX_ABS_SEC,
    bundlePath: BUNDLE_PATH,
    referenceCsv: REF_CSV,
  },
  summary: {
    rowsTotal: rows.length,
    missingReference,
    missingBundle,
    countExact,
    countWithinTolerance: countWithin,
    countOutlier,
    rowsCompared: absForP95.length,
    maxAbsDeltaSec,
    p95AbsDeltaSec,
    fail,
    failReason,
  },
  rows,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

const txt = [
  `jieqi lichun diff ${report.generatedAt}`,
  `compared: ${report.summary.rowsCompared} / years ${YEAR_MIN}-${YEAR_MAX}`,
  `missing_reference: ${missingReference}  missing_bundle: ${missingBundle}`,
  `exact: ${countExact}  within_tolerance: ${countWithin}  outlier: ${countOutlier}`,
  `maxAbsDeltaSec: ${maxAbsDeltaSec ?? "n/a"}  p95AbsDeltaSec: ${p95AbsDeltaSec ?? "n/a"}`,
  `FAIL: ${fail}  (${failReason || "ok"})`,
  `json: ${OUT_JSON}`,
].join("\n");
writeFileSync(OUT_TXT, txt, "utf8");

console.log(txt);

process.exit(fail ? 1 : 0);
