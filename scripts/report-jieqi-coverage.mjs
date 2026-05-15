/**
 * 1900~2100 × 12절 sparse domestic reference coverage / outlier 리포트.
 *
 * 출력:
 *   reports/jieqi-coverage.json
 *   reports/jieqi-coverage-missing.txt
 *
 * 환경변수: JIEQI_BUNDLE_PATH, JIEQI_REF_CSV, JIEQI_EXACT_MAX_ABS_SEC, JIEQI_TOLERANCE_SEC
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCsvLine,
  parseJieqiReferenceRows,
} from "./lib/parse-jieqi-reference-csv.mjs";
import {
  YEAR_MIN,
  YEAR_MAX,
  JIE_IDS,
  iterateGridCells,
  resolveBundleJieId,
  gridCellKey,
  findTermInstantUtc,
  classifyAbsDeltaSec,
} from "./lib/jieqi-grid.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const EXACT_MAX_ABS_SEC = Number(process.env.JIEQI_EXACT_MAX_ABS_SEC ?? 1);
const TOLERANCE_SEC = Number(process.env.JIEQI_TOLERANCE_SEC ?? 300);

const BUNDLE_PATH = process.env.JIEQI_BUNDLE_PATH
  ? resolve(process.env.JIEQI_BUNDLE_PATH)
  : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.json");
const REF_CSV = process.env.JIEQI_REF_CSV
  ? resolve(process.env.JIEQI_REF_CSV)
  : join(ROOT, "reference", "jieqi-reference.csv");
const OUT_DIR = join(ROOT, "reports");
const OUT_JSON = join(OUT_DIR, "jieqi-coverage.json");
const OUT_MISSING_TXT = join(OUT_DIR, "jieqi-coverage-missing.txt");
const HUMAN_QA_QUEUE = join(ROOT, "reference", "lichun-human-qa-queue.csv");

/** @returns {null | { tier1Total: number; rejected: number; patchUnnecessary: number; patchNeededEstimate: number; qaSampled: number }} */
function loadTier1HumanQaSummary() {
  if (!existsSync(HUMAN_QA_QUEUE)) return null;
  const lines = readFileSync(HUMAN_QA_QUEUE, "utf8").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]);
  const progIdx = header.indexOf("progress");
  if (progIdx < 0) return null;
  let rejected = 0;
  let unchecked = 0;
  let checking = 0;
  let exact = 0;
  let patched = 0;
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (!cells[progIdx]) continue;
    total++;
    const p = cells[progIdx];
    if (p === "rejected") rejected++;
    else if (p === "unchecked") unchecked++;
    else if (p === "checking") checking++;
    else if (p === "exact") exact++;
    else if (p === "patched") patched++;
  }
  const qaSampled = rejected + checking + exact + patched;
  return {
    tier1Total: total,
    rejected,
    patchUnnecessary: rejected,
    patchNeededEstimate: unchecked + checking,
    unchecked,
    checking,
    exact,
    patched,
    qaSampled,
    rejectionRateAmongSampled:
      qaSampled === 0 ? 0 : Math.round((rejected / qaSampled) * 10000) / 100,
  };
}

const thresholds = {
  exactMaxAbsSec: EXACT_MAX_ABS_SEC,
  toleranceSec: TOLERANCE_SEC,
};

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

/** @type {Map<string, ReturnType<typeof parseJieqiReferenceRows>[0]>} */
const refByCell = new Map();
for (const r of parseJieqiReferenceRows(readFileSync(REF_CSV, "utf8"))) {
  if (!Number.isFinite(r.calendarYear) || !r.jieId?.trim()) continue;
  if (!r.instantKst?.trim()) continue;
  const bundleJieId = resolveBundleJieId(r.jieId);
  refByCell.set(gridCellKey(r.calendarYear, bundleJieId), r);
}

const totalCount = (YEAR_MAX - YEAR_MIN + 1) * JIE_IDS.length;
/** @type {Record<string, { patched: number; total: number; pct: number }>} */
const byJieId = {};
for (const id of JIE_IDS) {
  byJieId[id] = { patched: 0, total: YEAR_MAX - YEAR_MIN + 1, pct: 0 };
}

/** @type {Array<Record<string, unknown>>} */
const missingList = [];
/** @type {Array<Record<string, unknown>>} */
const patchedList = [];

let countExact = 0;
let countWithinTolerance = 0;
let countOutlier = 0;
let countParseError = 0;
let countMissingBundle = 0;

for (const { calendarYear, bundleJieId } of iterateGridCells()) {
  const key = gridCellKey(calendarYear, bundleJieId);
  const ref = refByCell.get(key);

  if (!ref) {
    missingList.push({ calendarYear, jieId: bundleJieId });
    continue;
  }

  byJieId[bundleJieId].patched++;

  const bundleUtc = findTermInstantUtc(baziMap, calendarYear, bundleJieId);
  const entry = {
    calendarYear,
    jieId: ref.jieId,
    bundleJieId,
    referenceKst: ref.instantKst,
    bundleUtcIso: bundleUtc,
    source: ref.source,
    confidence: ref.confidence,
    verifiedBy: ref.verifiedBy,
    deltaSecRefMinusBundle: null,
    absDeltaSec: null,
    classification: null,
  };

  if (!bundleUtc) {
    entry.classification = "missing_bundle";
    countMissingBundle++;
    patchedList.push(entry);
    continue;
  }

  const bundleMs = Date.parse(bundleUtc);
  const refMs = Date.parse(ref.instantKst);
  if (Number.isNaN(bundleMs) || Number.isNaN(refMs)) {
    entry.classification = "parse_error";
    countParseError++;
    patchedList.push(entry);
    continue;
  }

  const deltaSec = Math.round((refMs - bundleMs) / 1000);
  const absSec = Math.abs(deltaSec);
  const classification = classifyAbsDeltaSec(absSec, thresholds);
  entry.deltaSecRefMinusBundle = deltaSec;
  entry.absDeltaSec = absSec;
  entry.classification = classification;

  if (classification === "exact") countExact++;
  else if (classification === "within_tolerance") countWithinTolerance++;
  else countOutlier++;

  patchedList.push(entry);
}

const patchedCount = patchedList.length;
for (const id of JIE_IDS) {
  const row = byJieId[id];
  row.pct =
    row.total === 0 ? 0 : Math.round((row.patched / row.total) * 10000) / 100;
}

const report = {
  generatedAt: new Date().toISOString(),
  strategy: "sparse_override",
  config: {
    yearMin: YEAR_MIN,
    yearMax: YEAR_MAX,
    jieIds: JIE_IDS,
    exactMaxAbsSec: EXACT_MAX_ABS_SEC,
    toleranceSec: TOLERANCE_SEC,
    bundlePath: BUNDLE_PATH,
    referenceCsv: REF_CSV,
  },
  summary: {
    totalCount,
    patchedCount,
    missingCount: missingList.length,
    coveragePct:
      totalCount === 0
        ? 0
        : Math.round((patchedCount / totalCount) * 10000) / 100,
    byJieId,
    tier1HumanQa: loadTier1HumanQaSummary(),
    patchedQuality: {
      compared: patchedCount - countMissingBundle - countParseError,
      countExact,
      countWithinTolerance,
      countOutlier,
      countParseError,
      countMissingBundle,
    },
  },
  missingList,
  patchedList,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

const missingLines = missingList.map(
  (m) => `${m.calendarYear},${m.jieId}`,
);
writeFileSync(
  OUT_MISSING_TXT,
  [
    `# jieqi coverage missing (no row in ${REF_CSV})`,
    `# generated: ${report.generatedAt}`,
    `# total missing: ${missingList.length} / ${totalCount}`,
    "calendarYear,jieId",
    ...missingLines,
  ].join("\n") + "\n",
  "utf8",
);

const t1 = report.summary.tier1HumanQa;
const txt = [
  `jieqi coverage ${report.generatedAt}`,
  `patched: ${patchedCount} / ${totalCount} (${report.summary.coveragePct}%)`,
  `missing: ${missingList.length}`,
  ...(t1
    ? [
        `tier1 QA: sampled=${t1.qaSampled}/${t1.tier1Total} rejected=${t1.rejected} patch_unnecessary=${t1.patchUnnecessary} patch_needed_est=${t1.patchNeededEstimate} rejection_rate_sampled=${t1.rejectionRateAmongSampled}%`,
      ]
    : []),
  `exact: ${countExact}  within_tolerance: ${countWithinTolerance}  outlier: ${countOutlier}`,
  `parse_error: ${countParseError}  missing_bundle: ${countMissingBundle}`,
  `json: ${OUT_JSON}`,
  `missing: ${OUT_MISSING_TXT}`,
].join("\n");

console.log(txt);
