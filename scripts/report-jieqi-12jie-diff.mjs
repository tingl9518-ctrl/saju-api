/**
 * CSV (calendarYear, jieId) 행 vs bundle baziyearTerms[year] 해당 절기 instantUtc 비교 리포트.
 * 입춘 전용 qa:jieqi:report 와 별도.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJieqiReferenceRows } from "./lib/parse-jieqi-reference-csv.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const LICHUN_IDS = new Set(["ipchun", "lichun", "입춘"]);
const JIE_ID_TO_BUNDLE_ID = { ipchun: "lichun", 입춘: "lichun" };

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
const OUT_JSON = join(OUT_DIR, "jieqi-12jie-report.json");
const OUT_TXT = join(OUT_DIR, "jieqi-12jie-report.txt");

function resolveBundleJieId(jieId) {
  const key = String(jieId).toLowerCase();
  return JIE_ID_TO_BUNDLE_ID[key] ?? key;
}

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
const baziMap = bundle.baziyearTerms;
if (!baziMap || typeof baziMap !== "object") {
  console.error("baziyearTerms 없음");
  process.exit(1);
}

const parsed = parseJieqiReferenceRows(readFileSync(REF_CSV, "utf8"));
const rows = [];
const absForP95 = [];
let countExact = 0;
let countWithin = 0;
let countOutlier = 0;
let missingBundle = 0;

for (const r of parsed) {
  if (!r.instantKst?.trim()) continue;
  if (!Number.isFinite(r.calendarYear)) continue;
  if (LICHUN_IDS.has(r.jieId.toLowerCase())) continue;

  const yKey = String(r.calendarYear);
  const bundleJieId = resolveBundleJieId(r.jieId);
  const terms = baziMap[yKey];
  const base = {
    calendarYear: r.calendarYear,
    jieId: r.jieId,
    bundleJieId,
    bundleUtcIso: null,
    referenceKst: r.instantKst,
    source: r.source,
    confidence: r.confidence,
    verifiedBy: r.verifiedBy,
    note: r.note,
    deltaSecRefMinusBundle: null,
    absDeltaSec: null,
    classification: null,
  };

  if (!terms?.length) {
    rows.push({ ...base, classification: "missing_bundle" });
    missingBundle++;
    continue;
  }

  const idx = terms.findIndex((t) => t.id === bundleJieId);
  if (idx < 0) {
    rows.push({ ...base, classification: "missing_jie_in_bundle" });
    missingBundle++;
    continue;
  }

  const bundleIso = terms[idx].instantUtc;
  const bundleMs = Date.parse(bundleIso);
  const refMs = Date.parse(r.instantKst);
  if (Number.isNaN(bundleMs) || Number.isNaN(refMs)) {
    rows.push({ ...base, bundleUtcIso: bundleIso, classification: "parse_error" });
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
    bundleUtcIso: bundleIso,
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

const report = {
  generatedAt: new Date().toISOString(),
  config: {
    scope: "non-lichun-csv-rows",
    exactMaxAbsSec: EXACT_MAX_ABS_SEC,
    toleranceSec: TOLERANCE_SEC,
    failMaxAbsSec: FAIL_MAX_ABS_SEC,
    bundlePath: BUNDLE_PATH,
    referenceCsv: REF_CSV,
  },
  summary: {
    rowsTotal: rows.length,
    missingBundle,
    countExact,
    countWithinTolerance: countWithin,
    countOutlier,
    rowsCompared: absForP95.length,
    maxAbsDeltaSec,
    p95AbsDeltaSec,
    fail,
    failReason: fail
      ? [
          failOutliers ? `outlier_rows=${countOutlier}` : "",
          failMax ? `maxAbsDeltaSec=${maxAbsDeltaSec}>${FAIL_MAX_ABS_SEC}` : "",
        ]
          .filter(Boolean)
          .join("; ")
      : "",
  },
  rows,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

const txt = [
  `jieqi 12jie diff ${report.generatedAt}`,
  `compared: ${report.summary.rowsCompared} (non-lichun CSV rows)`,
  `missing_bundle: ${missingBundle}`,
  `exact: ${countExact}  within_tolerance: ${countWithin}  outlier: ${countOutlier}`,
  `maxAbsDeltaSec: ${maxAbsDeltaSec ?? "n/a"}  p95AbsDeltaSec: ${p95AbsDeltaSec ?? "n/a"}`,
  `FAIL: ${fail}  (${report.summary.failReason || "ok"})`,
  `json: ${OUT_JSON}`,
].join("\n");
writeFileSync(OUT_TXT, txt, "utf8");

console.log(txt);
process.exit(fail ? 1 : 0);
