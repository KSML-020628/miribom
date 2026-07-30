import assert from "node:assert/strict";
import {
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

console.log("guide visibility fixtures: 7 passed");
