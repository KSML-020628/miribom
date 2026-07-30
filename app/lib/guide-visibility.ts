import type { GuidePage } from "./types";

// 페이지를 현재 답변 기준으로 보여줄지 판단한다.
// - activation이 없으면 공통 안내이므로 항상 보인다.
// - activation이 있으면 해당 질문의 답이 values에 포함될 때만 보인다.
//   (아직 답하지 않았거나 매칭되지 않으면 숨긴다 → "네를 골라야 나온다")
export function isPageVisible(page: GuidePage, answers: Record<string, string>): boolean {
  if (!page.activation) return true;
  const answer = answers[page.activation.question_id];
  if (!answer) return false;
  return page.activation.values.includes(answer);
}

export function visiblePages(pages: GuidePage[], answers: Record<string, string>): GuidePage[] {
  return pages.filter((page) => isPageVisible(page, answers));
}
