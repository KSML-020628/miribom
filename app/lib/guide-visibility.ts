import type { GuidePage, HospitalConfirmation, PersonalizationQuestion } from "./types";

export type GuideAnswers = Record<string, string>;

type Activatable = Pick<GuidePage, "activation"> | Pick<HospitalConfirmation, "activation">;

// 공통 항목은 항상 보이고, 조건부 항목은 현재 선택과 맞을 때만 보인다.
export function isGuideItemVisible(item: Activatable, answers: GuideAnswers): boolean {
  if (!item.activation) return true;
  const answer = answers[item.activation.question_id];
  return Boolean(answer && item.activation.values.includes(answer));
}

export function visiblePages(pages: GuidePage[], answers: GuideAnswers): GuidePage[] {
  return pages.filter((page) => isGuideItemVisible(page, answers));
}

export function visibleConfirmations(
  confirmations: HospitalConfirmation[],
  answers: GuideAnswers,
): HospitalConfirmation[] {
  return confirmations.filter((item) => isGuideItemVisible(item, answers));
}

export type SectionItem =
  | { kind: "page"; page: GuidePage }
  | { kind: "question"; question: PersonalizationQuestion };

// 아직 답하지 않은 조건부 안내 자리에는, 안내를 열어 줄 질문 카드를 그 위치에 끼워 넣는다.
// 같은 질문이 여러 단계의 안내를 여는 경우 처음 등장하는 자리에만 한 번 넣도록 placedQuestionIds로 추적한다.
export function buildSectionItems(
  pages: GuidePage[],
  questions: PersonalizationQuestion[],
  answers: GuideAnswers,
  placedQuestionIds: Set<string> = new Set(),
): SectionItem[] {
  const items: SectionItem[] = [];
  for (const page of pages) {
    if (isGuideItemVisible(page, answers)) {
      items.push({ kind: "page", page });
      continue;
    }
    const questionId = page.activation?.question_id;
    if (!questionId || answers[questionId] || placedQuestionIds.has(questionId)) continue;
    const question = questions.find((candidate) => candidate.question_id === questionId);
    if (!question) continue;
    placedQuestionIds.add(questionId);
    items.push({ kind: "question", question });
  }
  return items;
}
