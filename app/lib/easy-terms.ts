// 검사 안내문(내시경·건강검진 빈출) 어려운 용어 → 노인용 쉬운 설명 사전.
// ★ 런타임에 LLM이 생성하지 않는다. 미리 검수한 항목만 여기에 둔다.
// 출처 원칙: 질병관리청 국가건강정보포털 / 국립국어원 쉬운 우리말 /
// 한국장애인고용공단 '알기 쉬운 자료 제작 안내서'의 작성 원칙 기반.
// 위 사이트는 공개 API가 아니므로 콘텐츠를 크롤링·저장하지 않고 규칙만 반영한다.

export type EasyLevel = "must" | "info" | "check";

export interface EasyTerm {
  term: string;
  aliases: string[];
  easy: string;
  sub?: string;
  avoid: string[];
  image: string;
  level: EasyLevel;
}

export const EASY_TERMS: EasyTerm[] = [
  { term: "금식", aliases: ["공복", "절식", "금식하세요"], easy: "물도 음식도 드시면 안 돼요.", sub: "사탕·껌·물도 안 됩니다.", avoid: ["안전합니다", "괜찮습니다"], image: "물컵-금지", level: "must" },
  { term: "장정결제", aliases: ["장정결", "장세척제", "장 청소약", "관장약"], easy: "장을 비우는 약이에요.", sub: "안내문에 적힌 시간에 드세요.", avoid: ["임의로", "알아서"], image: "약봉지-물", level: "must" },
  { term: "항혈전제", aliases: ["항혈소판제", "피 묽게 하는 약", "아스피린 계열"], easy: "피가 잘 멎지 않게 하는 약이에요.", sub: "약을 바꾸지 말고 병원에 물어보세요.", avoid: ["끊으세요", "중단하세요", "안전합니다"], image: "약-피", level: "check" },
  { term: "항응고제", aliases: ["와파린", "혈액응고 억제제", "쿠마딘"], easy: "피가 잘 멎지 않게 하는 약이에요.", sub: "약을 바꾸지 말고 병원에 물어보세요.", avoid: ["끊으세요", "중단하세요"], image: "약-피", level: "check" },
  { term: "복합약물", aliases: ["복합제", "복합 성분약", "2가지 성분"], easy: "약이 두 가지 이상 섞여 있어요.", sub: "이런 약은 병원에 먼저 물어보세요.", avoid: ["안전합니다"], image: "약-여러개", level: "check" },
  { term: "위절제술", aliases: ["위 절제", "위 수술"], easy: "위 수술을 받으신 적이 있나요?", sub: "받으셨다면 병원에 말하세요.", avoid: [], image: "위-수술", level: "check" },
  { term: "진정내시경", aliases: ["수면내시경", "진정", "수면 검사"], easy: "잠든 상태로 검사를 받아요.", sub: "검사 뒤에는 직접 운전하지 마세요.", avoid: [], image: "잠-침대", level: "info" },
  { term: "보호자 동반", aliases: ["보호자 필요", "보호자와 함께", "동반자"], easy: "어른 한 명과 같이 오세요.", sub: "혼자 오면 검사를 못 할 수 있어요.", avoid: [], image: "두사람", level: "must" },
  { term: "내원", aliases: ["내원하세요", "방문"], easy: "병원에 오세요.", avoid: [], image: "병원", level: "info" },
  { term: "투약", aliases: ["복용", "경구 복용", "경구 투여"], easy: "약을 입으로 드세요.", avoid: [], image: "약-입", level: "info" },
  { term: "추적관찰", aliases: ["경과관찰", "추적 검사", "f/u"], easy: "알려준 때에 다시 검사하세요.", sub: "언제인지 병원에 물어보세요.", avoid: ["안전합니다", "문제없음"], image: "달력-체크", level: "check" },
  { term: "소견", aliases: ["소견입니다", "정상 소견", "이상 소견"], easy: "검사에서 본 결과예요.", sub: "자세한 뜻은 병원에 물어보세요.", avoid: ["안전합니다", "정상입니다"], image: "서류-돋보기", level: "check" },
  { term: "양성", aliases: ["양성입니다", "positive"], easy: "검사에서 무언가 발견됐어요.", sub: "뜻은 병원에 확인하세요.", avoid: ["좋은 결과", "안심", "안전합니다"], image: "서류-느낌표", level: "check" },
  { term: "음성", aliases: ["음성입니다", "negative"], easy: "찾던 것이 나오지 않았어요.", sub: "이 말만으로 다 알 수는 없어요.", avoid: ["문제없음", "안전합니다"], image: "서류-체크", level: "check" },
  { term: "경계치", aliases: ["경계성", "경계 범위"], easy: "기준에 가까운 숫자예요.", sub: "다음 검사 때 다시 확인하세요.", avoid: ["정상", "안전합니다"], image: "저울-중간", level: "check" },
];

export const GLOBAL_AVOID_WORDS = [
  "안전합니다", "안전", "문제없음", "이상 없음", "확실히", "괜찮습니다", "정상입니다",
];

export const EXTRA_HARD_TERMS = [
  "기저질환", "임상적", "항고혈압제", "검사 소견", "투여", "섭취", "익일", "금일",
];

export const HARD_TERMS = [
  ...EASY_TERMS.flatMap((term) =>
    [term.term, ...term.aliases].filter((word) => !`${term.easy} ${term.sub || ""}`.includes(word)),
  ),
  ...EXTRA_HARD_TERMS,
];

export function matchEasyTerms(text: string): EasyTerm[] {
  return EASY_TERMS.filter((entry) =>
    [entry.term, ...entry.aliases]
      .sort((a, b) => b.length - a.length)
      .some((key) => text.includes(key)),
  );
}

export function dictionaryForPrompt(text: string): string {
  const matched = matchEasyTerms(text);
  const entries = matched.length ? matched : EASY_TERMS;
  return entries.map((entry) =>
    `- ${[entry.term, ...entry.aliases].join(" / ")} → "${entry.easy}"${entry.sub ? `, "${entry.sub}"` : ""} | 그림: ${entry.image} | 등급: ${entry.level}`,
  ).join("\n");
}
