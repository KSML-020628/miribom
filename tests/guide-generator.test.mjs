import assert from "node:assert/strict";
import { stageOrder } from "../app/lib/stage-order.ts";

// 고정 단계는 기존 순서 그대로 유지된다.
assert.ok(stageOrder("지금 확인") < stageOrder("검사 3일 전"));
assert.ok(stageOrder("검사 3일 전") < stageOrder("검사 전날"));
assert.ok(stageOrder("검사 전날") < stageOrder("검사 당일"));
assert.ok(stageOrder("검사 당일") < stageOrder("병원에 올 때"));
assert.ok(stageOrder("병원에 올 때") < stageOrder("검사 후"));

// STAGE_ORDER에 없는 "N일/주/개월 전" 표현도 실제 날짜 간격 순서로 정렬된다.
assert.ok(stageOrder("검사 14일 전") < stageOrder("검사 7일 전"));
assert.ok(stageOrder("검사 7일 전") < stageOrder("검사 5일 전"));
assert.ok(stageOrder("검사 5일 전") < stageOrder("검사 3일 전"));
assert.ok(stageOrder("검사 3일 전") < stageOrder("검사 전날"));
assert.ok(stageOrder("수술 2주 전") < stageOrder("수술 3일 전"));
assert.ok(stageOrder("지금 확인") < stageOrder("검사 14일 전"));

// "N일/주 후" 표현은 검사 후보다 뒤로 정렬된다.
assert.ok(stageOrder("검사 후") < stageOrder("검사 3일 후"));
assert.ok(stageOrder("검사 3일 후") < stageOrder("수술 2주 후"));

// 시점을 전혀 알 수 없는 안내는 여전히 맨 뒤로 보낸다.
assert.ok(stageOrder("수술 2주 후") < stageOrder(""));

console.log("guide generator stage ordering fixtures: 13 passed");
