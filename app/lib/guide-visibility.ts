import type { GuidePage, HospitalConfirmation } from "./types";

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
