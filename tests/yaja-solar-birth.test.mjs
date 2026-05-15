import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyYajaDayRoll,
  isYajaLateZiWindow,
  normalizeYajaMode,
} from "../app/api/saju/yaja-solar-birth.js";
import {
  computePillarsKorean,
  koreanPillarsFromComputed,
} from "../app/api/saju/compute-pillars-korean.js";

describe("yaja-solar-birth", () => {
  test("normalizeYajaMode defaults to apply", () => {
    assert.equal(normalizeYajaMode(undefined), "apply");
    assert.equal(normalizeYajaMode(null), "apply");
    assert.equal(normalizeYajaMode(""), "apply");
  });

  test("normalizeYajaMode rejects invalid", () => {
    assert.throws(() => normalizeYajaMode("invalid"));
  });

  test("isYajaLateZiWindow 23:30-23:59 only", () => {
    assert.equal(isYajaLateZiWindow(23, 29), false);
    assert.equal(isYajaLateZiWindow(23, 30), true);
    assert.equal(isYajaLateZiWindow(23, 59), true);
    assert.equal(isYajaLateZiWindow(0, 10), false);
  });

  test("applyYajaDayRoll not_apply rolls day at 23:40", () => {
    const solar = { year: 2001, month: 1, day: 1 };
    assert.deepEqual(applyYajaDayRoll(solar, 23, 40, "apply"), solar);
    assert.deepEqual(applyYajaDayRoll(solar, 23, 40, "not_apply"), {
      year: 2001,
      month: 1,
      day: 2,
    });
    assert.deepEqual(applyYajaDayRoll(solar, 0, 10, "not_apply"), solar);
  });

  test("applyYajaDayRoll month boundary", () => {
    assert.deepEqual(
      applyYajaDayRoll({ year: 2000, month: 12, day: 31 }, 23, 45, "not_apply"),
      { year: 2001, month: 1, day: 1 },
    );
  });
});

describe("computePillarsKorean yaja QA", () => {
  const birth = { year: 2001, month: 1, day: 1 };
  const time = { hour: 23, minute: 40 };

  test("apply: 갑자 / 병자 (일주 당일, 子時천간 익일)", () => {
    const actual = koreanPillarsFromComputed(
      computePillarsKorean({
        birth,
        time,
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "apply",
      }),
    );
    assert.equal(actual.day, "갑자");
    assert.equal(actual.hour, "병자");
  });

  test("not_apply: 을축 / 병자", () => {
    const actual = koreanPillarsFromComputed(
      computePillarsKorean({
        birth,
        time,
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "not_apply",
      }),
    );
    assert.equal(actual.day, "을축");
    assert.equal(actual.hour, "병자");
  });

  test("2001-01-02 00:10 unchanged (no late-zi roll)", () => {
    const actual = koreanPillarsFromComputed(
      computePillarsKorean({
        birth: { year: 2001, month: 1, day: 2 },
        time: { hour: 0, minute: 10 },
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "apply",
      }),
    );
    assert.equal(actual.day, "을축");
    assert.equal(actual.hour, "병자");
  });

  test("default yajaMode matches apply", () => {
    const withDefault = koreanPillarsFromComputed(
      computePillarsKorean({
        birth,
        time,
        isLunar: false,
        isLeapMonth: false,
      }),
    );
    const withApply = koreanPillarsFromComputed(
      computePillarsKorean({
        birth,
        time,
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "apply",
      }),
    );
    assert.deepEqual(withDefault, withApply);
  });
});
