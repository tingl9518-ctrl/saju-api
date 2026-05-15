/**
 * 시드 번들(lunar-javascript)에 reference/jieqi-reference.csv 절입 행을 병합한다.
 * 입춘(ipchun/lichun)은 lichunUtcByCalendarYear + baziyearTerms[Y] lichun 동기화.
 * 그 외 절기는 baziyearTerms[Y]에서 id 일치 항목의 instantUtc 만 갱신.
 *
 * 사용:
 *   node scripts/merge-jieqi-reference-lichun.mjs --seed <bundle.lunarjs.json> [--csv path] [--out path]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJieqiReferenceRows } from "./lib/parse-jieqi-reference-csv.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const LICHUN_IDS = new Set(["ipchun", "lichun", "입춘"]);

/** CSV jieId → bundle baziyearTerms[].id */
const JIE_ID_TO_BUNDLE_ID = {
  ipchun: "lichun",
  입춘: "lichun",
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed" && argv[i + 1]) {
      out.seed = resolve(argv[++i]);
    } else if (argv[i] === "--csv" && argv[i + 1]) {
      out.csv = resolve(argv[++i]);
    } else if (argv[i] === "--out" && argv[i + 1]) {
      out.out = resolve(argv[++i]);
    }
  }
  return out;
}

function resolveBundleJieId(jieId) {
  const key = String(jieId).toLowerCase();
  return JIE_ID_TO_BUNDLE_ID[key] ?? key;
}

function isLichunJieId(jieId) {
  return LICHUN_IDS.has(String(jieId).toLowerCase());
}

/** KST(+09:00 등) ISO → UTC ISO8601 (번들 관례: toISOString) */
function kstInstantToUtcIso(instantKst) {
  const ms = Date.parse(instantKst);
  if (Number.isNaN(ms)) {
    throw new Error(`instantKst 파싱 실패: ${instantKst}`);
  }
  return new Date(ms).toISOString();
}

function sha256Short(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function warn(msg) {
  console.warn("[merge-jieqi-reference]", msg);
}

/**
 * @param {Record<string, { id: string; instantUtc: string }[]>} baziMap
 * @param {string} yKey
 * @param {string} bundleJieId
 */
function findTermIndex(baziMap, yKey, bundleJieId) {
  const terms = baziMap[yKey];
  if (!terms?.length) return -1;
  return terms.findIndex((t) => t.id === bundleJieId);
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {string[]} mergedPatches "1995:bailu" 형식
 */
function validateBundle(bundle, mergedPatches) {
  const lichunMap = bundle.lichunUtcByCalendarYear;
  const baziMap = bundle.baziyearTerms;
  if (!lichunMap || typeof lichunMap !== "object") {
    throw new Error("lichunUtcByCalendarYear 없음");
  }
  if (!baziMap || typeof baziMap !== "object") {
    throw new Error("baziyearTerms 없음");
  }

  const yearsBazi = Object.keys(baziMap)
    .map((k) => Number(k))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  for (const y of yearsBazi) {
    const key = String(y);
    const terms = baziMap[key];
    if (!Array.isArray(terms) || terms.length === 0) {
      throw new Error(`baziyearTerms[${key}] 비어 있음`);
    }
    if (terms[0].id !== "lichun") {
      throw new Error(`baziyearTerms[${key}][0].id 가 lichun 이 아님: ${terms[0].id}`);
    }
    const lc = lichunMap[key];
    if (lc != null) {
      const a = Date.parse(lc);
      const b = Date.parse(terms[0].instantUtc);
      if (Number.isNaN(a) || Number.isNaN(b) || a !== b) {
        throw new Error(
          `lichunUtc vs baziyearTerms[${key}][0] 불일치: lichunUtc=${lc} term0=${terms[0].instantUtc}`,
        );
      }
    }
    for (let i = 1; i < terms.length; i++) {
      const p0 = Date.parse(terms[i - 1].instantUtc);
      const p1 = Date.parse(terms[i].instantUtc);
      if (!(p0 < p1)) {
        throw new Error(
          `시간 역전: baziYear ${key} terms[${i - 1}] >= terms[${i}] (${terms[i - 1].instantUtc} vs ${terms[i].instantUtc})`,
        );
      }
    }
  }

  for (let i = 0; i < yearsBazi.length - 1; i++) {
    const y = yearsBazi[i];
    const yNext = yearsBazi[i + 1];
    if (yNext !== y + 1) continue;
    const tLast = baziMap[String(y)];
    const tNext = baziMap[String(yNext)];
    const endMs = Date.parse(tLast[tLast.length - 1].instantUtc);
    const startMs = Date.parse(tNext[0].instantUtc);
    if (!(endMs < startMs)) {
      throw new Error(
        `사주연 경계 역전: baziyearTerms[${y}] 마지막 >= [${yNext}] 입춘 (${tLast.at(-1).instantUtc} vs ${tNext[0].instantUtc})`,
      );
    }
  }

  for (const patch of mergedPatches) {
    const [yStr, bundleJieId] = patch.split(":");
    const y = Number(yStr);
    if (!baziMap[yStr]) {
      if (y >= 1969 && y <= 2035) {
        throw new Error(`병합 패치 ${patch}: baziyearTerms[${yStr}] 없음`);
      }
    } else if (findTermIndex(baziMap, yStr, bundleJieId) < 0) {
      throw new Error(`병합 패치 ${patch}: baziyearTerms에 id=${bundleJieId} 없음`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedPath =
    args.seed ??
    (process.env.JIEQI_SEED_BUNDLE_PATH
      ? resolve(process.env.JIEQI_SEED_BUNDLE_PATH)
      : null);
  const csvPath =
    args.csv ??
    (process.env.JIEQI_REF_CSV
      ? resolve(process.env.JIEQI_REF_CSV)
      : join(ROOT, "reference", "jieqi-reference.csv"));
  const outPath =
    args.out ??
    (process.env.JIEQI_MERGED_BUNDLE_PATH
      ? resolve(process.env.JIEQI_MERGED_BUNDLE_PATH)
      : join(ROOT, "app", "api", "saju", "data", "solar-terms", "bundle.json"));

  if (!seedPath) {
    console.error(
      "사용법: node scripts/merge-jieqi-reference-lichun.mjs --seed <bundle.lunarjs.json> [--csv] [--out]",
    );
    process.exit(1);
  }

  const seedText = readFileSync(seedPath, "utf8");
  const csvText = readFileSync(csvPath, "utf8");
  const rows = parseJieqiReferenceRows(csvText);

  const bundle = JSON.parse(seedText);
  /** @type {string[]} */
  const mergedPatches = [];

  for (const r of rows) {
    if (!r.instantKst || !r.instantKst.trim()) continue;
    const y = r.calendarYear;
    if (!Number.isFinite(y)) continue;

    const yKey = String(y);
    const csvJieId = r.jieId;
    const bundleJieId = resolveBundleJieId(csvJieId);
    const utcIso = kstInstantToUtcIso(r.instantKst.trim());
    const patchKey = `${yKey}:${bundleJieId}`;

    const baziMap = bundle.baziyearTerms;
    const terms = baziMap?.[yKey];

    if (!terms?.length) {
      if (isLichunJieId(csvJieId) && y === 2036) {
        if (bundle.lichunUtcByCalendarYear) {
          bundle.lichunUtcByCalendarYear[yKey] = utcIso;
        }
        mergedPatches.push(patchKey);
        warn(`CSV ${patchKey}: baziyearTerms 없음(2036) — lichunUtc 맵만 갱신`);
        continue;
      }
      throw new Error(
        `CSV calendarYear=${y} jieId=${csvJieId}: baziyearTerms[${yKey}] 없음 — 병합 불가`,
      );
    }

    const idx = findTermIndex(baziMap, yKey, bundleJieId);
    if (idx < 0) {
      throw new Error(
        `CSV calendarYear=${y} jieId=${csvJieId} (bundle id=${bundleJieId}): baziyearTerms[${yKey}]에 해당 절기 없음`,
      );
    }

    terms[idx].instantUtc = utcIso;

    if (isLichunJieId(csvJieId)) {
      const lichunMap = bundle.lichunUtcByCalendarYear;
      if (!lichunMap || !(yKey in lichunMap)) {
        warn(`CSV ${patchKey}: lichunUtcByCalendarYear[${yKey}] 없음 — baziyearTerms lichun만 갱신`);
      } else {
        bundle.lichunUtcByCalendarYear[yKey] = utcIso;
        if (idx !== 0) {
          warn(
            `CSV ${patchKey}: lichun이 terms[${idx}]에 있음 — lichunUtc 맵과 terms[0] 불일치 가능; 검증 단계에서 확인`,
          );
        }
      }
    }

    mergedPatches.push(patchKey);
  }

  const refHash = sha256Short(csvText);
  const nowIso = new Date().toISOString();

  validateBundle(bundle, mergedPatches);

  const prevMeta =
    bundle.meta && typeof bundle.meta === "object" ? bundle.meta : {};
  bundle.meta = {
    ...prevMeta,
    schemaVersion: prevMeta.schemaVersion ?? 1,
    generator: "scripts/merge-jieqi-reference-lichun.mjs",
    generatorPackage: prevMeta.generatorPackage ?? "lunar-javascript",
    generatedAt: nowIso,
    sourceType: "composite",
    referenceVersion: `jieqi-ref-csv:sha256-${refHash};merged:${mergedPatches.join(";") || "none"}`,
    mergedAt: nowIso,
    seedPath: seedPath.replace(ROOT + "/", ""),
    seedGeneratedAt: prevMeta.generatedAt ?? null,
    baseGenerator: prevMeta.generator ?? "scripts/build-solar-terms.mjs",
    manualOverridesApplied: false,
    manualOverrideIds: [],
    dataLineageNote:
      "Hybrid: lunar-javascript 시드 + reference/jieqi-reference.csv 절입 병합(입춘·12절 CSV 행). 상세: docs/jieqi-12jie-first-data-design.md",
  };

  writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
  console.log("Wrote", outPath, "| merged patches:", mergedPatches.join(", ") || "(none)");
}

main();
