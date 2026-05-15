/**
 * 입춘(lichun) 1900~2100 — missing / outlier 후보 리포트 (Tier1 blind QA 확대 없음).
 * sparse override: CSV 없는 연도는 시드(baseline) 메타 + 휴리스틱 우선순위.
 *
 * 입력: bundle.json, bundle.lunarjs.json, jieqi-reference.csv
 * 출력:
 *   reports/jieqi-lichun-missing.txt
 *   reports/jieqi-lichun-priority.json
 *   reports/jieqi-lichun-priority.txt
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJieqiReferenceRows } from "./lib/parse-jieqi-reference-csv.mjs";
import {
  YEAR_MIN,
  YEAR_MAX,
  LICHUN_IDS,
  utcIsoToKstIso,
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
const SEED_PATH = process.env.JIEQI_SEED_BUNDLE_PATH
  ? resolve(process.env.JIEQI_SEED_BUNDLE_PATH)
  : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.lunarjs.json");
const REF_CSV = process.env.JIEQI_REF_CSV
  ? resolve(process.env.JIEQI_REF_CSV)
  : join(ROOT, "reference", "jieqi-reference.csv");
const OUT_DIR = join(ROOT, "reports");
const OUT_MISSING = join(OUT_DIR, "jieqi-lichun-missing.txt");
const OUT_JSON = join(OUT_DIR, "jieqi-lichun-priority.json");
const OUT_TXT = join(OUT_DIR, "jieqi-lichun-priority.txt");

const thresholds = {
  exactMaxAbsSec: EXACT_MAX_ABS_SEC,
  toleranceSec: TOLERANCE_SEC,
};

/** @param {string} utcIso */
function kstHourFraction(utcIso) {
  const ms = Date.parse(utcIso);
  if (Number.isNaN(ms)) return null;
  const kst = new Date(ms + 9 * 3600 * 1000);
  return kst.getUTCHours() + kst.getUTCMinutes() / 60 + kst.getUTCSeconds() / 3600;
}

/**
 * CSV 없는 연도: 위키 錨点 수집 우선순위(휴리스틱).
 * 저녁형(15~24시) · 새벽형(0~6시) 입춘이 문서상 mismatch 다발 구간과 유사.
 * @param {number | null} kstHour
 */
function missingReferencePriorityScore(kstHour) {
  if (kstHour == null) return 0;
  let score = 0;
  const reasons = [];
  if (kstHour >= 15) {
    score += 100 + (kstHour - 15) * 2;
    reasons.push("seed_evening_kst");
  }
  if (kstHour <= 6) {
    score += 80 + (6 - kstHour) * 2;
    reasons.push("seed_dawn_kst");
  }
  if (kstHour > 6 && kstHour < 15) {
    score += 30;
    reasons.push("seed_midday_kst");
  }
  return { score, reasons };
}

if (!existsSync(BUNDLE_PATH) || !existsSync(SEED_PATH) || !existsSync(REF_CSV)) {
  console.error("bundle / seed / CSV 경로 확인 필요");
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
const lichunMerged = bundle.lichunUtcByCalendarYear ?? {};
const lichunSeed = seed.lichunUtcByCalendarYear ?? {};

/** @type {Map<number, ReturnType<typeof parseJieqiReferenceRows>[0]>} */
const refByYear = new Map();
for (const r of parseJieqiReferenceRows(readFileSync(REF_CSV, "utf8"))) {
  if (!Number.isFinite(r.calendarYear) || !r.instantKst?.trim()) continue;
  if (!LICHUN_IDS.has(r.jieId.toLowerCase())) continue;
  refByYear.set(r.calendarYear, r);
}

/** @type {Array<Record<string, unknown>>} */
const years = [];
/** @type {Array<Record<string, unknown>>} */
const outlierCandidates = [];
/** @type {Array<Record<string, unknown>>} */
const missingList = [];

let countExact = 0;
let countWithin = 0;
let countOutlier = 0;
let countMissingReference = 0;

for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
  const mergedUtc = lichunMerged[String(y)] ?? null;
  const seedUtc = lichunSeed[String(y)] ?? null;
  const ref = refByYear.get(y);
  const seedKst = seedUtc ? utcIsoToKstIso(seedUtc) : null;
  const mergedKst = mergedUtc ? utcIsoToKstIso(mergedUtc) : null;
  const seedHour = seedUtc ? kstHourFraction(seedUtc) : null;

  const row = {
    calendarYear: y,
    hasReference: Boolean(ref),
    seedUtcIso: seedUtc,
    mergedUtcIso: mergedUtc,
    seedInstantKst: seedKst,
    mergedInstantKst: mergedKst,
    referenceKst: ref?.instantKst ?? null,
    seedKstHour: seedHour != null ? Math.round(seedHour * 100) / 100 : null,
    seedEqualsMerged: seedUtc && mergedUtc ? seedUtc === mergedUtc : null,
    deltaSecRefMinusBundle: null,
    absDeltaSec: null,
    classification: null,
    priorityScore: 0,
    priorityReasons: [],
    tier: null,
  };

  if (!mergedUtc) {
    row.classification = "missing_bundle";
    row.tier = "error";
    years.push(row);
    continue;
  }

  if (!ref) {
    row.classification = "missing_reference";
    countMissingReference++;
    const { score, reasons } = missingReferencePriorityScore(seedHour);
    row.priorityScore = score;
    row.priorityReasons = reasons;
    row.tier = "missing_reference";
    missingList.push({
      calendarYear: y,
      jieId: "lichun",
      seedInstantKst: seedKst,
      seedKstHour: row.seedKstHour,
      priorityScore: score,
    });
    outlierCandidates.push({
      ...row,
      candidateType: "missing_reference",
      sortKey: score,
    });
    years.push(row);
    continue;
  }

  const bundleMs = Date.parse(mergedUtc);
  const refMs = Date.parse(ref.instantKst);
  const deltaSec = Math.round((refMs - bundleMs) / 1000);
  const absSec = Math.abs(deltaSec);
  const classification = classifyAbsDeltaSec(absSec, thresholds);
  row.deltaSecRefMinusBundle = deltaSec;
  row.absDeltaSec = absSec;
  row.classification = classification;
  row.priorityScore = absSec;
  row.priorityReasons = ["has_csv_delta"];

  if (classification === "exact") {
    countExact++;
    row.tier = "patch_complete";
  } else if (classification === "within_tolerance") {
    countWithin++;
    row.tier = "within_tolerance";
    outlierCandidates.push({
      ...row,
      candidateType: "within_tolerance",
      sortKey: absSec,
    });
  } else {
    countOutlier++;
    row.tier = "confirmed_outlier";
    outlierCandidates.push({
      ...row,
      candidateType: "confirmed_outlier",
      sortKey: absSec,
    });
  }
  years.push(row);
}

outlierCandidates.sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
missingList.sort((a, b) => b.priorityScore - a.priorityScore);

const top10Patch = outlierCandidates.slice(0, 10).map((r) => ({
  calendarYear: r.calendarYear,
  candidateType: r.candidateType,
  classification: r.classification,
  absDeltaSec: r.absDeltaSec ?? null,
  deltaSecRefMinusBundle: r.deltaSecRefMinusBundle ?? null,
  seedKstHour: r.seedKstHour ?? null,
  priorityScore: r.priorityScore,
  priorityReasons: r.priorityReasons,
}));

const batchRecommendation = {
  totalMissingLichun: countMissingReference,
  suggestedYearsPerWeek: 5,
  estimatedWeeksAt5PerWeek: Math.ceil(countMissingReference / 5),
  suggestedYearsPerWeekConservative: 4,
  estimatedWeeksAt4PerWeek: Math.ceil(countMissingReference / 4),
  phases: [
    {
      phase: 1,
      label: "회귀 앵커·문서 확정 연도 유지",
      years: years
        .filter((r) => r.tier === "patch_complete")
        .map((r) => r.calendarYear),
    },
    {
      phase: 2,
      label: "TOP10 우선 錨点 수집",
      years: top10Patch.map((r) => r.calendarYear),
    },
    {
      phase: 3,
      label: "나머지 missing_reference",
      yearsPerBatch: 5,
      count: Math.max(0, countMissingReference - 10),
    },
  ],
};

const report = {
  generatedAt: new Date().toISOString(),
  strategy: "sparse_override",
  config: {
    yearRange: [YEAR_MIN, YEAR_MAX],
    exactMaxAbsSec: EXACT_MAX_ABS_SEC,
    toleranceSec: TOLERANCE_SEC,
    bundlePath: BUNDLE_PATH,
    seedPath: SEED_PATH,
    referenceCsv: REF_CSV,
  },
  summary: {
    lichunTotal: YEAR_MAX - YEAR_MIN + 1,
    patchedWithCsv: refByYear.size,
    missingReference: countMissingReference,
    patchCompleteExact: countExact,
    countWithinTolerance: countWithin,
    confirmedOutlier: countOutlier,
    lichunCoveragePct:
      Math.round((refByYear.size / (YEAR_MAX - YEAR_MIN + 1)) * 10000) / 100,
  },
  outlierCandidatesSorted: outlierCandidates,
  top10PatchPriority: top10Patch,
  batchRecommendation,
  missingList,
  years,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

writeFileSync(
  OUT_MISSING,
  [
    `# lichun missing reference (no row in jieqi-reference.csv)`,
    `# generated: ${report.generatedAt}`,
    `# count: ${missingList.length} / ${report.summary.lichunTotal}`,
    "calendarYear,jieId,seedInstantKst,seedKstHour,priorityScore",
    ...missingList.map(
      (m) =>
        `${m.calendarYear},lichun,${m.seedInstantKst},${m.seedKstHour},${m.priorityScore}`,
    ),
  ].join("\n") + "\n",
  "utf8",
);

const txtLines = [
  `jieqi lichun priority ${report.generatedAt}`,
  `lichun CSV: ${refByYear.size}/${report.summary.lichunTotal} (${report.summary.lichunCoveragePct}%)`,
  `missing_reference: ${countMissingReference}  exact: ${countExact}  outlier: ${countOutlier}`,
  "",
  "TOP 10 patch priority:",
  ...top10Patch.map(
    (r, i) =>
      `  ${i + 1}. ${r.calendarYear} — ${r.candidateType}` +
      (r.absDeltaSec != null ? ` |Δ|=${r.absDeltaSec}s` : "") +
      (r.seedKstHour != null ? ` seedKST~${r.seedKstHour}h` : "") +
      ` score=${r.priorityScore}`,
  ),
  "",
  `batch: ${batchRecommendation.suggestedYearsPerWeek} years/week → ~${batchRecommendation.estimatedWeeksAt5PerWeek} weeks for ${countMissingReference} missing`,
  "",
  `missing: ${OUT_MISSING}`,
  `json: ${OUT_JSON}`,
];
writeFileSync(OUT_TXT, txtLines.join("\n"), "utf8");

console.log(txtLines.join("\n"));
