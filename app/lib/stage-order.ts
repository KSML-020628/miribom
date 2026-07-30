function daysFromMatch(match: RegExpMatchArray): number {
  const amount = Number(match[1]);
  if (match[2] === "주") return amount * 7;
  if (match[2] === "개월") return amount * 30;
  return amount;
}

// stage 문자열이 나타내는 "검사일 기준 며칠 전(양수)"을 계산한다. 검사 후는 음수, 알 수 없으면 null.
// "검사 7일 전"처럼 고정 목록에 없는 표현도 원문에 적힌 숫자를 그대로 읽어 날짜 간격으로 바꾼다.
export function daysBeforeProcedure(stage: string): number | null {
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

// 검사 예정일(YYYY-MM-DD)과 오늘(기본값: 앱에 들어온 시각) 사이의 날짜 차이를 구한다.
// 날짜를 아직 모르면(형식이 안 맞으면) null을 돌려주고, 시간대는 병원 안내문 기준인 한국 시간(KST)으로 계산한다.
export function daysUntil(procedureDateIso: string, from: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(procedureDateIso)) return null;
  const target = new Date(`${procedureDateIso}T00:00:00+09:00`);
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(from);
  const today = new Date(`${todayIso}T00:00:00+09:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

// 오늘부터 검사일까지 남은 날짜를 기준으로, 지금 당장 볼 필요가 있는 단계와
// 나중에 봐도 되는 단계를 나눈다. 시점을 알 수 없는 안내("지금 확인" 포함)는 항상 보여주고,
// 이미 시작된(오늘이 그 단계에 도달했거나 지난) 단계는 모두 보여준다. 아직 시작된 단계가
// 하나도 없다면, 가장 먼저 다가올 다음 단계 하나만 미리 보여주어 화면이 비어 보이지 않게 한다.
export function partitionSectionsByTiming<T extends { title: string }>(
  groups: T[],
  daysUntilProcedure: number | null,
): { visible: T[]; collapsed: T[] } {
  if (daysUntilProcedure === null) return { visible: groups, collapsed: [] };

  const timing = groups.map((group) => ({ group, day: daysBeforeProcedure(group.title) }));
  const always = new Set(
    timing
      .filter(({ day }) => day === null || day === Number.POSITIVE_INFINITY)
      .map(({ group }) => group),
  );
  const timed = timing.filter(
    (entry): entry is { group: T; day: number } => entry.day !== null && entry.day !== Number.POSITIVE_INFINITY,
  );
  const started = timed.filter(({ day }) => daysUntilProcedure <= day);

  let extraVisible: T[];
  if (started.length > 0) {
    extraVisible = started.map(({ group }) => group);
  } else if (timed.length > 0) {
    const nearest = timed.reduce((closest, entry) => (entry.day > closest.day ? entry : closest));
    extraVisible = [nearest.group];
  } else {
    extraVisible = [];
  }

  const extraVisibleSet = new Set(extraVisible);
  return {
    visible: groups.filter((group) => always.has(group) || extraVisibleSet.has(group)),
    collapsed: groups.filter((group) => !always.has(group) && !extraVisibleSet.has(group)),
  };
}
