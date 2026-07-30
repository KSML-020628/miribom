import type { ChatEvidence, ChatIntent, ChatReply } from "./types";
import { fetchUpstage } from "./upstage-fetch";

const UPSTAGE_CHAT_URL = "https://api.upstage.ai/v1/chat/completions";
const BANNED_ASSURANCE = ["안전합니다", "문제없", "괜찮습니다", "확실히"];

function getApiKey(): string {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  return apiKey;
}

function numericTokens(text: string): string[] {
  return text.match(/\d+(?::\d+)?(?:\.\d+)?/g) || [];
}

function isSafeAnswer(answer: string, evidence: ChatEvidence[]): boolean {
  if (!answer.trim() || answer.length > 280) return false;
  if (BANNED_ASSURANCE.some((word) => answer.includes(word))) return false;
  const sourceNumbers = new Set(numericTokens(evidence.map((item) => item.text).join(" ")));
  return numericTokens(answer).every((number) => sourceNumbers.has(number));
}

export async function answerFromEvidence(
  question: string,
  intent: ChatIntent,
  evidence: ChatEvidence[],
): Promise<string | null> {
  const model = process.env.UPSTAGE_CHAT_MODEL || "solar-pro3";
  const response = await fetchUpstage(UPSTAGE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "너는 병원 검사 안내문을 고령자에게 쉽게 설명하는 도우미다.",
            "아래에 제공된 근거 문장 안에서만 답한다.",
            "근거에 없는 의학 지식, 진단, 판단, 지시를 만들지 않는다.",
            "한 문장에는 한 가지 내용만 쓰고, 최대 두 문장으로 짧게 답한다.",
            "원문의 날짜, 시각, 숫자, 용량, 약 이름을 바꾸거나 새로 만들지 않는다.",
            "약 질문에는 혼자 약을 바꾸지 말고 병원에 확인하라는 문장을 포함한다.",
            "근거가 충분하지 않으면 grounded를 false로 설정한다.",
            "안전합니다, 문제없음, 괜찮습니다 같은 단정 표현을 쓰지 않는다.",
            "JSON 이외의 내용은 출력하지 않는다.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            intent,
            evidence,
            output: {
              answer: "짧고 쉬운 한국어 답변",
              grounded: true,
            },
          }),
        },
      ],
      temperature: 0,
      reasoning_effort: "low",
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  }, { timeoutMs: 20_000, retries: 0, operation: "solar_guide_chat" });

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as {
      answer?: unknown;
      grounded?: unknown;
    };
    if (parsed.grounded !== true || typeof parsed.answer !== "string") return null;
    return isSafeAnswer(parsed.answer, evidence) ? parsed.answer.trim() : null;
  } catch {
    return null;
  }
}

export function buildGroundedReply(
  answer: string,
  intent: ChatIntent,
  evidence: ChatEvidence[],
  understoodAs?: string,
): ChatReply {
  const sourceInstructionIds = [...new Set(evidence.flatMap((item) => item.sourceInstructionIds || []))];
  const sourceDocumentIds = [...new Set(evidence.flatMap((item) => item.sourceDocumentIds || []))];
  return {
    kind: "grounded",
    answer,
    intent,
    understood_as: understoodAs,
    evidence,
    evidenceStatus: evidence.some((item) => item.source === "맞춤 안내서")
      ? "FOUND_IN_APPLIED_GUIDE"
      : "FOUND_IN_DOCUMENT",
    sourceInstructionIds,
    sourceDocumentIds,
    suggestions: [
      "물은 언제까지 마셔요?",
      "먹는 약은 어떻게 해요?",
      "병원에는 몇 시에 가요?",
    ],
  };
}
