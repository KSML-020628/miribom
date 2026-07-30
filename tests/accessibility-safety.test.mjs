import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const validationSource = read("app/lib/document-validation.ts");
assert.match(validationSource, /UNSUPPORTED_DOCUMENT/);
assert.match(validationSource, /UNREADABLE_DOCUMENT/);
assert.match(validationSource, /공급가액/);

const chatSource = read("app/lib/chat-retrieval.ts");
assert.match(chatSource, /evidenceStatus: "NOT_FOUND"/);
assert.match(chatSource, /안내문에 해당 내용이 없어요\.\\n자세한 사항은 병원에 문의해 주세요\./);
assert.match(chatSource, /directMatches === 0/);

const pageSource = read("app/page.tsx");
assert.doesNotMatch(pageSource, /miribom-high-contrast/);
assert.doesNotMatch(pageSource, /highContrast/);
assert.doesNotMatch(pageSource, /고대비/);

const reviewSource = read("app/ui/ReviewStep.tsx");
assert.match(reviewSource, /type="date"/);
assert.doesNotMatch(reviewSource, /type="time"/);
assert.match(reviewSource, /className="timeSelect"/);
assert.match(reviewSource, /24시간/);
assert.match(reviewSource, /잘 모르겠어요/);
const alwaysVisibleReview = reviewSource.split("{editing &&")[0];
assert.match(alwaysVisibleReview, /type="date"/);
assert.match(alwaysVisibleReview, /className="timeSelect"/);
assert.match(alwaysVisibleReview, /검사 날짜 바로 선택/);

const guideSource = read("app/ui/GuideStep.tsx");
assert.match(guideSource, /className="verticalGuideDocument screenOnly"/);
assert.match(guideSource, /speaking \? "멈추기" : "전체 듣기"/);
assert.match(guideSource, /GuideAnswerSummary/);

const css = read("app/globals.css");
assert.match(css, /--font-time:/);
assert.doesNotMatch(css, /\[data-contrast="high"\]/);

console.log("accessibility and safety fixtures: 15 passed");
