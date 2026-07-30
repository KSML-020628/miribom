import assert from "node:assert/strict";
import {
  buildSectionItems,
  isGuideItemVisible,
  visibleConfirmations,
  visiblePages,
} from "../app/lib/guide-visibility.ts";

const common = { title: "공통", activation: undefined };
const yesOnly = {
  title: "네일 때",
  activation: { question_id: "sedation", values: ["yes"] },
};
const unknownOnly = {
  title: "모를 때 확인",
  activation: { question_id: "sedation", values: ["unknown"] },
};

assert.equal(isGuideItemVisible(common, {}), true);
assert.equal(isGuideItemVisible(yesOnly, {}), false);
assert.equal(isGuideItemVisible(yesOnly, { sedation: "yes" }), true);
assert.equal(isGuideItemVisible(yesOnly, { sedation: "no" }), false);

const pages = visiblePages(
  [
    { ...common, page_number: 1 },
    { ...yesOnly, page_number: 2 },
  ],
  { sedation: "yes" },
);
assert.deepEqual(pages.map((page) => page.page_number), [1, 2]);

const confirmations = visibleConfirmations(
  [unknownOnly],
  { sedation: "unknown" },
);
assert.equal(confirmations.length, 1);
assert.equal(visibleConfirmations([unknownOnly], { sedation: "yes" }).length, 0);

const sedationQuestion = {
  question_id: "sedation",
  question: "잠든 상태로 검사받으세요?",
  options: [
    { value: "yes", label: "네", symbol: "○" },
    { value: "no", label: "아니요", symbol: "×" },
  ],
};

// 답하지 않은 조건부 안내 자리에는 그 안내를 여는 질문 카드가 대신 들어간다.
const itemsUnanswered = buildSectionItems(
  [{ ...common, page_number: 1 }, { ...yesOnly, page_number: 2 }],
  [sedationQuestion],
  {},
);
assert.deepEqual(itemsUnanswered.map((item) => item.kind), ["page", "question"]);
assert.equal(itemsUnanswered[1].question.question_id, "sedation");

// 답을 하면 카드 대신 실제 안내가 그 자리에 나타난다.
const itemsAnswered = buildSectionItems(
  [{ ...common, page_number: 1 }, { ...yesOnly, page_number: 2 }],
  [sedationQuestion],
  { sedation: "yes" },
);
assert.deepEqual(itemsAnswered.map((item) => item.kind), ["page", "page"]);

// 같은 질문이 여러 안내를 여는 경우에도 카드는 한 번만 들어간다(나머지는 답하면 제자리에 나타난다).
const placed = new Set();
const itemsShared = buildSectionItems(
  [{ ...yesOnly, page_number: 2 }, { ...yesOnly, page_number: 3 }],
  [sedationQuestion],
  {},
  placed,
);
assert.deepEqual(itemsShared.map((item) => item.kind), ["question"]);
assert.equal(placed.size, 1);

console.log("guide visibility fixtures: 12 passed");
