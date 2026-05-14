/**
 * 절입(節) 시각 JSON 생성 — MVP: 1969~2036 사주연도(입춘 기준) 구간,
 * 실제 사용 연도 1970~2035 출생을 커버하기 위한 버퍼 포함.
 *
 * 원천: lunar-javascript (Julian Day → UTC) 천문 역법.
 * 운영 전 KASI 월력요항과 샘플 연도 대조 검증 권장.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lunar } from "lunar-javascript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../app/api/saju/data/solar-terms");
const OUT_FILE = join(OUT_DIR, "bundle.json");

/** 사주 월을 가르는 12절 (節만, 中气 제외) — 순서 고정 */
const JIE_CN = [
  "立春",
  "惊蛰",
  "清明",
  "立夏",
  "芒种",
  "小暑",
  "立秋",
  "白露",
  "寒露",
  "立冬",
  "大雪",
  "小寒",
];

const JIE_ID = [
  "lichun",
  "jingzhe",
  "qingming",
  "lixia",
  "mangzhong",
  "xiaoshu",
  "liqiu",
  "bailu",
  "hanlu",
  "lidong",
  "daxue",
  "xiaohan",
];

function jdToUtcIso(jd) {
  const ms = (jd - 2440587.5) * 86400000;
  return new Date(ms).toISOString();
}

function collectBaziYearTerms(baziYear) {
  const tblB = Lunar.fromYmd(baziYear, 6, 1).getJieQiTable();
  const tblBp1 = Lunar.fromYmd(baziYear + 1, 6, 1).getJieQiTable();
  const lichunB = tblB["立春"];
  const lichunBp1 = tblBp1["立春"];
  const ms0 = lichunB.getJulianDay();
  const ms1 = lichunBp1.getJulianDay();
  const terms = [];
  for (let i = 0; i < JIE_CN.length; i++) {
    const cn = JIE_CN[i];
    let picked = null;
    for (const tbl of [tblB, tblBp1]) {
      const sol = tbl[cn];
      if (!sol) continue;
      const jd = sol.getJulianDay();
      if (jd >= ms0 && jd < ms1) {
        picked = { id: JIE_ID[i], instantUtc: jdToUtcIso(jd) };
        break;
      }
    }
    if (!picked) {
      throw new Error(`Missing jie ${cn} for baziYear ${baziYear}`);
    }
    terms.push(picked);
  }
  terms.sort(
    (a, b) => Date.parse(a.instantUtc) - Date.parse(b.instantUtc),
  );
  return terms;
}

const BAZI_YEAR_MIN = 1969;
const BAZI_YEAR_MAX = 2035;
const CALENDAR_LICHUN_MIN = BAZI_YEAR_MIN;
const CALENDAR_LICHUN_MAX = 2036;

mkdirSync(OUT_DIR, { recursive: true });

const lichunUtcByCalendarYear = {};
for (let y = CALENDAR_LICHUN_MIN; y <= CALENDAR_LICHUN_MAX; y++) {
  const tbl = Lunar.fromYmd(y, 6, 1).getJieQiTable();
  const lc = tbl["立春"];
  if (!lc) throw new Error(`No 立春 for calendar year ${y}`);
  lichunUtcByCalendarYear[String(y)] = jdToUtcIso(lc.getJulianDay());
}

const baziyearTerms = {};
for (let b = BAZI_YEAR_MIN; b <= BAZI_YEAR_MAX; b++) {
  baziyearTerms[String(b)] = collectBaziYearTerms(b);
}

const bundle = {
  meta: {
    schemaVersion: 1,
    supportedBirthYearsMvp: [1970, 2035],
    baziYearTermsRange: [BAZI_YEAR_MIN, BAZI_YEAR_MAX],
    instantField: "instantUtc",
    instantMeaning:
      "각 절입의 순간을 UTC ISO8601로 저장. 생년월일시는 Asia/Seoul 벽시계로 해석한 뒤 동일 타임라인(UTC ms)으로 비교한다.",
    sourceNote:
      "생성 시점의 절입 시각은 npm 패키지 lunar-javascript의 Julian Day 역산 결과이다. 대한민국 관보·월력요항(KASI)과 초 단위 차이가 날 수 있으므로, 상용 서비스 전 별도 검증·교체 파이프라인을 권장한다.",
    generator: "scripts/build-solar-terms.mjs",
    generatorPackage: "lunar-javascript",
    generatedAt: new Date().toISOString(),
  },
  lichunUtcByCalendarYear,
  baziyearTerms,
};

writeFileSync(OUT_FILE, JSON.stringify(bundle, null, 2), "utf8");
console.log("Wrote", OUT_FILE);
