/**
 * bundle.lunarjs.json 시드 기준 1900~2100 × 12절 baseline CSV export.
 *
 * 사용:
 *   node scripts/export-jieqi-baseline.mjs [--bundle path] [--out path]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  iterateGridCells,
  findTermInstantUtc,
  utcIsoToKstIso,
} from "./lib/jieqi-grid.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const DEFAULT_BUNDLE = join(
  ROOT,
  "app",
  "api",
  "saju",
  "data",
  "solar-terms",
  "bundle.lunarjs.json",
);
const DEFAULT_OUT = join(
  ROOT,
  "reference",
  "generated",
  "baziyear-terms-baseline-1900-2100.csv",
);

function parseArgs(argv) {
  const out = { bundle: DEFAULT_BUNDLE, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bundle" && argv[i + 1]) {
      out.bundle = resolve(argv[++i]);
    } else if (argv[i] === "--out" && argv[i + 1]) {
      out.out = resolve(argv[++i]);
    }
  }
  return out;
}

function escapeCsvField(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function main() {
  const { bundle: bundlePath, out: outPath } = parseArgs(process.argv.slice(2));

  if (!existsSync(bundlePath)) {
    console.error("bundle 없음:", bundlePath);
    process.exit(1);
  }

  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const baziMap = bundle.baziyearTerms;
  if (!baziMap || typeof baziMap !== "object") {
    console.error("baziyearTerms 없음");
    process.exit(1);
  }

  const header = "calendarYear,jieId,instantUtc,instantKst";
  const lines = [header];
  let exported = 0;
  let skipped = 0;

  for (const { calendarYear, bundleJieId } of iterateGridCells()) {
    const instantUtc = findTermInstantUtc(baziMap, calendarYear, bundleJieId);
    if (!instantUtc) {
      skipped++;
      continue;
    }
    const instantKst = utcIsoToKstIso(instantUtc);
    lines.push(
      [
        calendarYear,
        bundleJieId,
        escapeCsvField(instantUtc),
        escapeCsvField(instantKst),
      ].join(","),
    );
    exported++;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    `Wrote ${outPath} | rows: ${exported}${skipped ? ` (skipped ${skipped})` : ""}`,
  );
}

main();
