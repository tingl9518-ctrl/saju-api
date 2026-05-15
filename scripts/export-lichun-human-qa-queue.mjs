/**
 * Tier1 입춘 sparse override — human QA 큐·배치 리포트 생성.
 *
 * 패턴 (시드 lunar-js 기준):
 *   A) 양력 2/4, KST 10:00~15:59
 *   B) 양력 2/5 시드(20연) — 1995/2024형; KST 00~03 다수·일부 04~12 포함
 *
 * 출력:
 *   reports/lichun-tier1-years.json
 *   reports/lichun-tier1-batch.txt
 *   reports/lichun-human-qa-queue.csv
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCsvLine,
  parseJieqiReferenceRows,
} from "./lib/parse-jieqi-reference-csv.mjs";
import {
  LICHUN_IDS,
  utcIsoToKstIso,
  classifyAbsDeltaSec,
  TIER1_BLIND_QA_YEAR_MIN,
  TIER1_BLIND_QA_YEAR_MAX,
} from "./lib/jieqi-grid.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const EXACT_MAX_ABS_SEC = Number(process.env.JIEQI_EXACT_MAX_ABS_SEC ?? 1);
const TOLERANCE_SEC = Number(process.env.JIEQI_TOLERANCE_SEC ?? 300);

const SEED_PATH = process.env.JIEQI_SEED_BUNDLE_PATH
  ? resolve(process.env.JIEQI_SEED_BUNDLE_PATH)
  : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.lunarjs.json");
const MERGED_PATH = process.env.JIEQI_BUNDLE_PATH
  ? resolve(process.env.JIEQI_BUNDLE_PATH)
  : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.json");
const REF_CSV = process.env.JIEQI_REF_CSV
  ? resolve(process.env.JIEQI_REF_CSV)
  : join(ROOT, "reference", "jieqi-reference.csv");
const REF_QUEUE = join(ROOT, "reference", "lichun-human-qa-queue.csv");
const OUT_DIR = join(ROOT, "reports");
const OUT_QUEUE = join(OUT_DIR, "lichun-human-qa-queue.csv");
const OUT_TIER_JSON = join(OUT_DIR, "lichun-tier1-years.json");
const OUT_BATCH_TXT = join(OUT_DIR, "lichun-tier1-batch.txt");

/** 이미 CSV·병합 exact — Tier1 큐 제외 */
const PATCHED_YEARS = new Set([1995, 1997, 2001, 2024]);

/** @param {string} utcIso */
function kstParts(utcIso) {
  const ms = Date.parse(utcIso);
  const d = new Date(ms + 9 * 3600 * 1000);
  return {
    calendarYear: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    frac: d.getUTCHours() + d.getUTCMinutes() / 60,
  };
}

/**
 * @param {ReturnType<typeof kstParts>} p
 */
function classifyTier1Pattern(p) {
  if (p.month === 2 && p.day === 4 && p.frac >= 10 && p.frac < 16) return "A";
  if (p.month === 2 && p.day === 5) return "B";
  return null;
}

/** @param {ReturnType<typeof kstParts>} p */
function feb5SubBand(p) {
  if (p.frac < 4) return "feb5_00-03_kst";
  if (p.frac < 13) return "feb5_04-12_kst";
  return "feb5_other_kst";
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {string} path */
function loadSavedQueue(path) {
  /** @type {Map<number, { qaStatus: string; csvStatus: string; progress: string; note: string }>} */
  const map = new Map();
  if (!existsSync(path)) return map;
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return map;
  const header = parseCsvLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  const cy = idx("calendarYear");
  const qa = idx("qaStatus");
  const csv = idx("csvStatus");
  const prog = idx("progress");
  const note = idx("note");
  if (cy < 0 || prog < 0) return map;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const year = Number(cells[cy]);
    if (!Number.isFinite(year)) continue;
    const progress = cells[prog] ?? "unchecked";
    if (progress === "unchecked") continue;
    map.set(year, {
      qaStatus: qa >= 0 ? cells[qa] : "pending",
      csvStatus: csv >= 0 ? cells[csv] : "no_row",
      progress,
      note: note >= 0 ? cells[note] : "",
    });
  }
  return map;
}

if (!existsSync(SEED_PATH) || !existsSync(MERGED_PATH)) {
  console.error("seed / merged bundle 경로 확인");
  process.exit(1);
}

const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
const merged = JSON.parse(readFileSync(MERGED_PATH, "utf8"));
const lichunSeed = seed.lichunUtcByCalendarYear ?? {};
const lichunMerged = merged.lichunUtcByCalendarYear ?? {};

/** @type {Map<number, { instantKst: string }>} */
const refByYear = new Map();
if (existsSync(REF_CSV)) {
  for (const r of parseJieqiReferenceRows(readFileSync(REF_CSV, "utf8"))) {
    if (!Number.isFinite(r.calendarYear) || !r.instantKst?.trim()) continue;
    if (!LICHUN_IDS.has(r.jieId.toLowerCase())) continue;
    refByYear.set(r.calendarYear, r);
  }
}

/** @type {Array<Record<string, unknown>>} */
const queue = [];
const savedQueue = loadSavedQueue(REF_QUEUE);

for (let y = TIER1_BLIND_QA_YEAR_MIN; y <= TIER1_BLIND_QA_YEAR_MAX; y++) {
  if (PATCHED_YEARS.has(y)) continue;
  const seedUtc = lichunSeed[String(y)];
  if (!seedUtc) continue;
  const p = kstParts(seedUtc);
  const tier = classifyTier1Pattern(p);
  if (!tier) continue;

  const seedKst = utcIsoToKstIso(seedUtc);
  const seedKstLabel = `${p.month}/${p.day} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;

  const ref = refByYear.get(y);
  let csvStatus = "no_row";
  let qaStatus = "pending";
  let progress = "unchecked";
  let note = "";

  if (ref) {
    const mergedUtc = lichunMerged[String(y)];
    if (!mergedUtc) {
      csvStatus = "row_missing_bundle";
    } else {
      const bundleMs = Date.parse(mergedUtc);
      const refMs = Date.parse(ref.instantKst);
      if (Number.isNaN(bundleMs) || Number.isNaN(refMs)) {
        csvStatus = "row_parse_error";
      } else {
        const absSec = Math.abs(Math.round((refMs - bundleMs) / 1000));
        const cls = classifyAbsDeltaSec(absSec, {
          exactMaxAbsSec: EXACT_MAX_ABS_SEC,
          toleranceSec: TOLERANCE_SEC,
        });
        csvStatus = cls;
        if (cls === "exact") {
          progress = "patched";
          qaStatus = "confirmed_match";
        } else if (cls === "outlier") {
          progress = "checking";
          qaStatus = "confirmed_mismatch";
          note = "CSV 있으나 병합 후 outlier — 錨点 재확인";
        } else {
          progress = "checking";
          qaStatus = "confirmed_mismatch";
        }
      }
    }
  }

  const saved = savedQueue.get(y);
  if (saved) {
    qaStatus = saved.qaStatus;
    csvStatus = saved.csvStatus;
    progress = saved.progress;
    note = saved.note;
  }

  queue.push({
    calendarYear: y,
    tier,
    pattern: tier === "A" ? "feb4_10-16_kst" : feb5SubBand(p),
    seedInstantKst: seedKst,
    seedKstLabel,
    qaStatus,
    csvStatus,
    progress,
    note,
  });
}

queue.sort((a, b) => {
  const tier = String(a.tier).localeCompare(String(b.tier));
  if (tier !== 0) return tier;
  return Number(a.calendarYear) - Number(b.calendarYear);
});

const tierA = queue.filter((r) => r.tier === "A").map((r) => r.calendarYear);
const tierB = queue.filter((r) => r.tier === "B").map((r) => r.calendarYear);

const tierJson = {
  generatedAt: new Date().toISOString(),
  strategy: "sparse_override_tier1",
  description:
    "Tier1: A feb4 10-16 KST (13y), B feb5 seed (20y). Patched 1995/1997/2001/2024 excluded. feb4 evening excluded.",
  counts: {
    total: queue.length,
    tierA: tierA.length,
    tierB: tierB.length,
    progress: {
      unchecked: queue.filter((r) => r.progress === "unchecked").length,
      checking: queue.filter((r) => r.progress === "checking").length,
      exact: queue.filter((r) => r.progress === "exact").length,
      patched: queue.filter((r) => r.progress === "patched").length,
      rejected: queue.filter((r) => r.progress === "rejected").length,
    },
    patchUnnecessary: queue.filter((r) => r.progress === "rejected").length,
    patchNeededEstimate: queue.filter(
      (r) => r.progress === "unchecked" || r.progress === "checking",
    ).length,
  },
  tierA,
  tierB,
  progressLegend: {
    unchecked: "위키 錨点 미확인",
    checking: "확인 중 / CSV 초안",
    exact: "위키 확인·CSV exact (병합 전 검증)",
    patched: "CSV 반영·병합 exact",
    rejected: "패치 불필요(시드≈위키)",
  },
  queue,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_TIER_JSON, JSON.stringify(tierJson, null, 2), "utf8");

const csvHeader =
  "calendarYear,tier,pattern,seedInstantKst,seedKstLabel,qaStatus,csvStatus,progress,note";
const csvLines = queue.map((r) =>
  [
    r.calendarYear,
    r.tier,
    r.pattern,
    escapeCsv(r.seedInstantKst),
    escapeCsv(r.seedKstLabel),
    r.qaStatus,
    r.csvStatus,
    r.progress,
    escapeCsv(r.note),
  ].join(","),
);
const queueCsv = `${csvHeader}\n${csvLines.join("\n")}\n`;
writeFileSync(REF_QUEUE, queueCsv, "utf8");
writeFileSync(OUT_QUEUE, queueCsv, "utf8");

const batchLines = [
  `# Tier1 lichun human QA batch`,
  `# generated: ${tierJson.generatedAt}`,
  `# total: ${queue.length} (A=${tierA.length}, B=${tierB.length})`,
  `# progress: unchecked | checking | exact | patched | rejected`,
  "",
];

for (const tier of ["A", "B"]) {
  batchLines.push(
    `## Tier ${tier} — ${tier === "A" ? "feb4 10~16 KST" : "feb5 seed (2/5 KST)"}`,
  );
  batchLines.push("");
  for (const r of queue.filter((q) => q.tier === tier)) {
    batchLines.push(
      [
        `- ${r.calendarYear}`,
        `seed ${r.seedKstLabel}`,
        `QA=${r.qaStatus}`,
        `CSV=${r.csvStatus}`,
        `progress=${r.progress}`,
        r.note ? `(${r.note})` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  batchLines.push("");
}

batchLines.push("## Suggested weekly batch (5 years, A→B interleave)");
const interleaved = [];
const aRows = queue.filter((q) => q.tier === "A");
const bRows = queue.filter((q) => q.tier === "B");
const maxLen = Math.max(aRows.length, bRows.length);
for (let i = 0; i < maxLen; i++) {
  if (aRows[i]) interleaved.push(aRows[i]);
  if (bRows[i]) interleaved.push(bRows[i]);
}
for (let w = 0; w < Math.ceil(interleaved.length / 5); w++) {
  const chunk = interleaved.slice(w * 5, w * 5 + 5);
  batchLines.push(
    `Week ${w + 1}: ${chunk.map((r) => r.calendarYear).join(", ")}`,
  );
}

writeFileSync(OUT_BATCH_TXT, `${batchLines.join("\n")}\n`, "utf8");

console.log(
  [
    `Tier1 queue: ${queue.length} years (A=${tierA.length}, B=${tierB.length})`,
    `queue: ${OUT_QUEUE}`,
    `tier json: ${OUT_TIER_JSON}`,
    `batch: ${OUT_BATCH_TXT}`,
    `unchecked: ${queue.filter((r) => r.progress === "unchecked").length}`,
    `rejected: ${queue.filter((r) => r.progress === "rejected").length}`,
    `patch_needed_est: ${queue.filter((r) => r.progress === "unchecked" || r.progress === "checking").length}`,
  ].join("\n"),
);
