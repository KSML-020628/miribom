import type {
  ChatEvidence,
  ChatIntent,
  ChatReply,
  ChatTurn,
  FinalGuideResult,
  ParsedPage,
} from "./types";
import { parsedPageText } from "./parsed-pages";

interface IntentRule {
  intent: Exclude<ChatIntent, "unknown">;
  queryTerms: string[];
  documentTerms: string[];
}

interface ClassifiedQuestion {
  intent: ChatIntent;
  normalizedQuestion: string;
  searchTerms: string[];
  understoodAs?: string;
  immediateReply?: ChatReply;
}

interface SearchChunk extends ChatEvidence {
  normalized: string;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "water",
    queryTerms: ["물", "생수", "마셔", "마실", "음료", "커피", "차", "주스"],
    documentTerms: ["물", "생수", "음료", "금수", "금식", "마시"],
  },
  {
    intent: "food",
    queryTerms: ["밥", "음식", "먹어", "먹지", "죽", "식사", "반찬", "간식", "사탕", "껌"],
    documentTerms: ["식사", "음식", "죽", "반찬", "금식", "섭취", "사탕", "껌"],
  },
  {
    intent: "medicine",
    queryTerms: ["약", "혈압약", "당뇨약", "아스피린", "와파린", "복용", "먹는약", "약어케"],
    documentTerms: ["약", "복용", "투약", "혈압약", "당뇨약", "항혈전제", "항응고제", "아스피린", "와파린"],
  },
  {
    intent: "bowel_prep",
    queryTerms: ["장약", "장청소", "장정결", "오라팡", "쿨프렙", "관장", "비우는약"],
    documentTerms: ["장정결", "장세척", "장을 비우", "오라팡", "쿨프렙", "관장", "복용"],
  },
  {
    intent: "fasting",
    queryTerms: ["금식", "공복", "아무것도", "언제부터안", "몇시부터안", "먹으면안", "마시면안"],
    documentTerms: ["금식", "공복", "먹지", "드시면 안", "마시면 안", "중단"],
  },
  {
    intent: "time",
    queryTerms: ["몇시", "언제", "시간", "오늘", "내일", "전날", "당일", "아침", "저녁"],
    documentTerms: ["시", "시간", "전날", "당일", "아침", "저녁", "오전", "오후"],
  },
  {
    intent: "driving",
    queryTerms: ["운전", "차몰아", "차몰", "자가용", "운전해"],
    documentTerms: ["운전", "차량", "귀가", "보호자"],
  },
  {
    intent: "guardian",
    queryTerms: ["보호자", "같이가", "같이와", "혼자가", "동반", "데려다"],
    documentTerms: ["보호자", "동반", "혼자", "귀가"],
  },
  {
    intent: "arrival",
    queryTerms: ["병원몇시", "도착", "접수", "병원가", "내원", "어디로", "전화번호", "연락처", "전화해"],
    documentTerms: ["도착", "접수", "내원", "병원", "예약 시간", "전화", "연락처", "문의"],
  },
  {
    intent: "dental",
    queryTerms: ["치아", "이빨", "틀니", "임플란트", "흔들리는이"],
    documentTerms: ["치아", "치과", "틀니", "임플란트", "흔들리는"],
  },
  {
    intent: "general",
    queryTerms: ["준비", "뭐해", "뭘해", "알려줘", "안내", "검사준비"],
    documentTerms: ["준비", "검사", "안내"],
  },
];

const FILLER_WORDS = [
  "저기",
  "근데",
  "그러면",
  "그런데",
  "혹시",
  "있잖아",
  "있잖아요",
  "좀",
  "그냥",
  "제가",
  "나는",
  "나",
];

const AMBIGUOUS_ONLY = new Set([
  "돼",
  "돼요",
  "되나요",
  "어떻게",
  "어케",
  "언제",
  "몇시",
  "지금",
  "오늘",
  "그거",
  "그건",
  "그전에는",
  "먹어도돼",
  "먹어도돼요",
]);

const OFF_TOPIC_TERMS = [
  "날씨",
  "주식",
  "환율",
  "코딩",
  "프로그래밍",
  "영화",
  "노래",
  "맛집",
  "여행",
  "정치",
  "축구",
  "야구",
  "로또",
  "운세",
  "농담",
];

const SYMPTOM_TERMS = [
  "배가 아",
  "배 아파",
  "배아파",
  "아파",
  "아프",
  "아파요",
  "아프고",
  "가슴이 아",
  "통증",
  "토했",
  "토해",
  "피가 나",
  "출혈이 생",
  "피가 계속",
  "열이 나",
  "숨이 안",
  "숨쉬기",
  "쓰러",
  "의식",
  "너무 어지",
];

const MEDICAL_JUDGMENT_TERMS = [
  "검사 받아도",
  "검사해도",
  "괜찮을까",
  "괜찮아",
  "안전해",
  "병인가",
  "진단",
  "약 끊어",
  "약을 끊",
  "계속 먹어",
];

const MEDICINE_DECISION_TERMS = [
  "끊어",
  "끊을",
  "중단해",
  "중단할",
  "먹지 말",
  "계속 먹",
  "바꿔",
];

const PROMPT_ATTACK_TERMS = [
  "이전 지시",
  "명령을 무시",
  "프롬프트",
  "시스템 메시지",
  "규칙을 무시",
];

const DEFAULT_SUGGESTIONS = [
  "물은 언제까지 마셔요?",
  "먹는 약은 어떻게 해요?",
  "병원에는 몇 시에 가요?",
];

function compact(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:.]/gu, "")
    .trim();
}

function cleanQuestion(text: string): string {
  let cleaned = text.normalize("NFKC").trim();
  for (const filler of FILLER_WORDS) {
    cleaned = cleaned.replaceAll(filler, " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]): boolean {
  const normalized = compact(text);
  return terms.some((term) => normalized.includes(compact(term)));
}

function detectIntent(text: string): ChatIntent {
  const normalized = compact(text);
  const scored = INTENT_RULES.map((rule) => ({
    intent: rule.intent,
    score: rule.queryTerms.reduce(
      (sum, term) => sum + (normalized.includes(compact(term)) ? Math.max(2, compact(term).length) : 0),
      0,
    ),
  })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].intent : "unknown";
}

function lastConversationIntent(history: ChatTurn[]): ChatIntent {
  for (const turn of [...history].reverse()) {
    if (turn.role !== "user") continue;
    const intent = turn.intent && turn.intent !== "unknown" ? turn.intent : detectIntent(turn.text);
    if (intent !== "unknown" && intent !== "general" && intent !== "time") return intent;
  }
  return "unknown";
}

function reply(
  kind: ChatReply["kind"],
  answer: string,
  intent: ChatIntent = "unknown",
  suggestions = DEFAULT_SUGGESTIONS,
): ChatReply {
  return { kind, answer, intent, evidence: [], suggestions };
}

export function classifyChatQuestion(question: string, history: ChatTurn[] = []): ClassifiedQuestion {
  const normalizedQuestion = cleanQuestion(question);
  const firstIntent = detectIntent(normalizedQuestion);

  if (includesAny(normalizedQuestion, PROMPT_ATTACK_TERMS)) {
    return {
      intent: "unknown",
      normalizedQuestion,
      searchTerms: [],
      immediateReply: reply(
        "off_topic",
        "저는 병원에서 받은 검사 안내문만 설명할 수 있어요. 안내문에 대해 물어봐 주세요.",
      ),
    };
  }

  if (includesAny(normalizedQuestion, SYMPTOM_TERMS)) {
    return {
      intent: "unknown",
      normalizedQuestion,
      searchTerms: [],
      immediateReply: reply(
        "symptom",
        "저는 검사 안내문만 설명해요. 아프거나 몸이 이상하면 이 답변에 의존하지 말고 병원이나 의료진에게 바로 알려 주세요.",
        "unknown",
        ["병원 전화번호를 알려줘", "검사 준비를 알려줘"],
      ),
    };
  }

  if (
    includesAny(normalizedQuestion, MEDICAL_JUDGMENT_TERMS)
    || (firstIntent === "medicine" && includesAny(normalizedQuestion, MEDICINE_DECISION_TERMS))
  ) {
    return {
      intent: firstIntent,
      normalizedQuestion,
      searchTerms: [],
      immediateReply: reply(
        "ask_hospital",
        "검사를 받아도 되는지나 약을 바꿔도 되는지는 제가 판단할 수 없어요. 혼자 결정하지 말고 병원이나 약을 처방한 의료진에게 확인해 주세요.",
        firstIntent,
        ["병원 전화번호를 알려줘", "안내문에 적힌 약 설명을 알려줘"],
      ),
    };
  }

  if (includesAny(normalizedQuestion, OFF_TOPIC_TERMS)) {
    return {
      intent: "unknown",
      normalizedQuestion,
      searchTerms: [],
      immediateReply: reply(
        "off_topic",
        "저는 지금 올려주신 검사 안내문만 설명할 수 있어요. 물, 음식, 약, 검사 시간에 대해 물어봐 주세요.",
      ),
    };
  }

  let intent = detectIntent(normalizedQuestion);
  let understoodAs: string | undefined;
  const compactQuestion = compact(normalizedQuestion);

  const genericAmbiguous = AMBIGUOUS_ONLY.has(compactQuestion);
  if (genericAmbiguous || ((intent === "unknown" || intent === "time") && compactQuestion.length <= 5)) {
    const previousIntent = lastConversationIntent(history);
    if (previousIntent !== "unknown") {
      intent = previousIntent;
      understoodAs = "바로 앞에서 물어본 내용에 이어진 질문으로 이해했어요.";
    } else {
      return {
        intent: "unknown",
        normalizedQuestion,
        searchTerms: [],
        immediateReply: reply(
          "clarification",
          "무엇이 궁금한지 조금만 더 알려 주세요. 아래에서 골라도 돼요.",
        ),
      };
    }
  }

  if (intent === "unknown") {
    return {
      intent,
      normalizedQuestion,
      searchTerms: [],
      immediateReply: reply(
        "off_topic",
        "이 질문은 검사 안내문과 관련된 내용을 찾기 어려워요. 물, 음식, 약, 검사 시간에 대해 물어봐 주세요.",
      ),
    };
  }

  const rule = INTENT_RULES.find((item) => item.intent === intent);
  return {
    intent,
    normalizedQuestion,
    understoodAs,
    searchTerms: [...new Set([normalizedQuestion, ...(rule?.documentTerms || [])])],
  };
}

function splitDocument(text: string): string[] {
  const rawBlocks = text
    .replace(/\r/g, "")
    .split(/\n{2,}|(?=^#{1,6}\s)|(?=^[-*]\s)/gm)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length >= 8);

  const chunks: string[] = [];
  for (const block of rawBlocks) {
    if (block.length <= 520) {
      chunks.push(block);
      continue;
    }
    const sentences = block.split(/(?<=[.!?。]|다\.)\s+/);
    let current = "";
    for (const sentence of sentences) {
      if (current && `${current} ${sentence}`.length > 520) {
        chunks.push(current);
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.slice(0, 240);
}

function guideChunks(guide: FinalGuideResult): SearchChunk[] {
  return guide.pages.map((page) => {
    const text = [page.procedure_id, page.section, page.when, page.title, ...page.body].filter(Boolean).join(" · ");
    return { source: "맞춤 안내서", text, normalized: compact(text) };
  });
}

function meaningfulTokens(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}:]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 || /^\d+$/.test(token));
}

function scoreChunk(chunk: SearchChunk, classification: ClassifiedQuestion): number {
  let score = chunk.source === "맞춤 안내서" ? 1 : 0;
  const questionTokens = meaningfulTokens(classification.normalizedQuestion);
  for (const token of questionTokens) {
    if (chunk.normalized.includes(compact(token))) score += Math.max(2, token.length);
  }
  for (const term of classification.searchTerms.slice(1)) {
    if (chunk.normalized.includes(compact(term))) score += 2;
  }
  const questionNumbers = classification.normalizedQuestion.match(/\d+(?::\d+)?/g) || [];
  for (const number of questionNumbers) {
    if (chunk.text.includes(number)) score += 5;
  }
  return score;
}

function containsRequiredFact(chunk: SearchChunk, classification: ClassifiedQuestion): boolean {
  const question = compact(classification.normalizedQuestion);
  if (question.includes("전화번호") || question.includes("연락처")) {
    return /\b(?:\d{2,4}[\s-]*\d{3,4}[\s-]*\d{4}|\d{4}[\s-]*\d{4})\b/.test(chunk.text);
  }
  if (question.includes("몇시") || question.includes("몇 시")) {
    return /(?:오전|오후|아침|저녁|밤)?\s*\d{1,2}(?::\d{2})?\s*시/.test(chunk.text);
  }
  return true;
}

export function retrieveChatEvidence(
  pages: ParsedPage[],
  guide: FinalGuideResult,
  classification: ClassifiedQuestion,
): ChatEvidence[] {
  const documentChunks: SearchChunk[] = pages.flatMap((page) =>
    splitDocument(parsedPageText(page)).map((text) => ({
      source: "병원 안내문" as const,
      text,
      pageNumber: page.pageNumber,
      normalized: compact(text),
    })),
  );

  return [...guideChunks(guide), ...documentChunks]
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, classification) }))
    .filter((item) => item.score >= 3 && containsRequiredFact(item.chunk, classification))
    .sort((a, b) => b.score - a.score || (a.chunk.source === "맞춤 안내서" ? -1 : 1))
    .slice(0, 3)
    .map(({ chunk }) => ({
      source: chunk.source,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
    }));
}

export function safeFallbackFromEvidence(
  classification: ClassifiedQuestion,
  evidence: ChatEvidence[],
): ChatReply {
  if (!evidence.length) {
    return {
      kind: "ask_hospital",
      answer: "이 안내문에서는 답을 찾지 못했어요. 병원에 전화해 확인해 주세요.",
      intent: classification.intent,
      understood_as: classification.understoodAs,
      evidence: [],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const preferred = evidence.find((item) => item.source === "맞춤 안내서") || evidence[0];
  const first = preferred.text.replace(/\s+/g, " ").trim();
  const excerpt = first.length > 150 ? `${first.slice(0, 147)}…` : first;
  const medicineNotice = classification.intent === "medicine"
    ? " 혼자 약을 바꾸지 말고 병원에 확인해 주세요."
    : "";
  return {
    kind: "grounded",
    answer: `안내문에는 “${excerpt}”라고 적혀 있어요.${medicineNotice}`,
    intent: classification.intent,
    understood_as: classification.understoodAs,
    evidence,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export const CHAT_DEFAULT_SUGGESTIONS = DEFAULT_SUGGESTIONS;
