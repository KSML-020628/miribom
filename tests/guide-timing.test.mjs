import assert from "node:assert/strict";
import { daysUntil, partitionSectionsByTiming } from "../app/lib/stage-order.ts";

// 검사일까지 남은 날짜는 시간대와 무관하게 한국 시간(KST) 기준 날짜로 계산된다.
assert.equal(daysUntil("2026-08-10", new Date("2026-07-30T10:00:00Z")), 11); // KST 07-30 19:00
assert.equal(daysUntil("2026-08-10", new Date("2026-08-08T20:00:00+09:00")), 2);
assert.equal(daysUntil("2026-08-10", new Date("2026-08-10T05:00:00+09:00")), 0);
assert.equal(daysUntil("확인 필요"), null);
assert.equal(daysUntil(""), null);

const stageGroups = [
  { title: "지금 확인" },
  { title: "검사 7일 전" },
  { title: "검사 3일 전" },
  { title: "검사 당일" },
];

// 11일 남았으면 아직 시작된 단계가 없으니, 지금 확인 + 가장 먼저 다가올 "7일 전"만 미리 보여준다.
const at11Days = partitionSectionsByTiming(stageGroups, 11);
assert.deepEqual(at11Days.visible.map((g) => g.title), ["지금 확인", "검사 7일 전"]);
assert.deepEqual(at11Days.collapsed.map((g) => g.title), ["검사 3일 전", "검사 당일"]);

// 2일 남았으면 "7일 전"과 "3일 전"은 이미 시작(지남)했으니 둘 다 보여주고, 아직 안 온 "당일"만 접어 둔다.
const at2Days = partitionSectionsByTiming(stageGroups, 2);
assert.deepEqual(at2Days.visible.map((g) => g.title), ["지금 확인", "검사 7일 전", "검사 3일 전"]);
assert.deepEqual(at2Days.collapsed.map((g) => g.title), ["검사 당일"]);

// 당일이 되면 모든 단계가 이미 시작된 것이므로 접히는 것 없이 전부 보인다.
const at0Days = partitionSectionsByTiming(stageGroups, 0);
assert.deepEqual(at0Days.visible.map((g) => g.title), stageGroups.map((g) => g.title));
assert.equal(at0Days.collapsed.length, 0);

// 검사 날짜를 모르면(계산 불가) 아무것도 접지 않고 전부 보여준다.
const unknownDate = partitionSectionsByTiming(stageGroups, null);
assert.deepEqual(unknownDate.visible, stageGroups);
assert.equal(unknownDate.collapsed.length, 0);

// "병원에 물어볼 내용"처럼 시점을 알 수 없는 섹션도 항상 보여준다.
const withUnknownSection = partitionSectionsByTiming(
  [...stageGroups, { title: "병원에 물어볼 내용" }],
  11,
);
assert.ok(withUnknownSection.visible.some((g) => g.title === "병원에 물어볼 내용"));

console.log("guide timing fixtures: 11 passed");
