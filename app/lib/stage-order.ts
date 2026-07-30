function daysFromMatch(match: RegExpMatchArray): number {
  const amount = Number(match[1]);
  if (match[2] === "주") return amount * 7;
  if (match[2] === "개월") return amount * 30;
  return amount;
}

// stage 문자열이 나타내는 "검사일 기준 며칠 전(양수)"을 계산한다. 검사 후는 음수, 알 수 없으면 null.
// "검사 7일 전"처럼 고정 목록에 없는 표현도 원문에 적힌 숫자를 그대로 읽어 날짜 간격으로 바꾼다.
function daysBeforeProcedure(stage: string): number | null {
  if (stage === "지금 확인") return Number.POSITIVE_INFINITY;
  if (stage === "검사 전날") return 1;
  if (stage === "검사 당일") return 0;
  if (stage === "병원에 올 때") return -0.5;
  if (stage === "검사 후") return -1;
  const before = stage.match(/(\d+)\s*(일|주|개월)\s*전/);
  if (before) return daysFromMatch(before);
  const after = stage.match(/(\d+)\s*(일|주|개월)\s*후/);
  if (after) return -(1 + daysFromMatch(after));
  return null;
}

// 며칠 남았는지를 정렬 값으로 바꾼다: 날짜가 많이 남을수록(이른 시점일수록) 앞쪽에 오고,
// "지금 확인"은 항상 맨 앞, 시점을 전혀 알 수 없는 안내는 맨 뒤에 둔다.
export function stageOrder(stage: string): number {
  const daysBefore = daysBeforeProcedure(stage);
  if (daysBefore === null) return Number.POSITIVE_INFINITY;
  if (daysBefore === Number.POSITIVE_INFINITY) return Number.NEGATIVE_INFINITY;
  return -daysBefore;
}
