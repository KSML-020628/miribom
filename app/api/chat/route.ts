import { NextResponse } from "next/server";
import { answerFromEvidence, buildGroundedReply } from "@/app/lib/chat-answer";
import {
  classifyChatQuestion,
  retrieveChatEvidence,
  safeFallbackFromEvidence,
} from "@/app/lib/chat-retrieval";
import type { ChatTurn, FinalGuideResult, ParsedPage } from "@/app/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_QUESTION_LENGTH = 240;
const MAX_DOCUMENT_LENGTH = 120_000;
const MAX_DOCUMENT_PAGES = 100;

function isGuide(value: unknown): value is FinalGuideResult {
  if (!value || typeof value !== "object") return false;
  const guide = value as Partial<FinalGuideResult>;
  return guide.mode === "final_guide" && Array.isArray(guide.pages);
}

function safeHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is ChatTurn => (
      Boolean(turn)
      && typeof turn === "object"
      && (turn.role === "user" || turn.role === "assistant")
      && typeof turn.text === "string"
    ))
    .slice(-6)
    .map((turn) => ({ ...turn, text: turn.text.slice(0, MAX_QUESTION_LENGTH) }));
}

function safePages(value: unknown): ParsedPage[] {
  if (!Array.isArray(value)) return [];
  let remainingLength = MAX_DOCUMENT_LENGTH;
  const pages: ParsedPage[] = [];
  for (const candidate of value.slice(0, MAX_DOCUMENT_PAGES)) {
    if (!candidate || typeof candidate !== "object" || remainingLength <= 0) break;
    const page = candidate as Partial<ParsedPage>;
    const pageNumber = typeof page.pageNumber === "number" && page.pageNumber > 0
      ? Math.floor(page.pageNumber)
      : pages.length + 1;
    const markdown = typeof page.markdown === "string"
      ? page.markdown.slice(0, remainingLength)
      : "";
    remainingLength -= markdown.length;
    const text = typeof page.text === "string"
      ? page.text.slice(0, Math.max(0, remainingLength))
      : "";
    remainingLength -= text.length;
    pages.push({ pageNumber, markdown, text, blocks: [] });
  }
  return pages;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      question?: unknown;
      pages?: unknown;
      guide?: unknown;
      history?: unknown;
    };
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "궁금한 내용을 입력해 주세요." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json({ error: "질문을 조금 더 짧게 적어 주세요." }, { status: 400 });
    }
    if (!isGuide(body.guide)) {
      return NextResponse.json({ error: "먼저 쉬운 안내서를 만들어 주세요." }, { status: 400 });
    }

    const classification = classifyChatQuestion(question, safeHistory(body.history));
    if (classification.immediateReply) {
      return NextResponse.json(classification.immediateReply);
    }

    const evidence = retrieveChatEvidence(
      safePages(body.pages),
      body.guide,
      classification,
    );
    if (!evidence.length) {
      return NextResponse.json(safeFallbackFromEvidence(classification, evidence));
    }

    try {
      const answer = await answerFromEvidence(
        classification.normalizedQuestion,
        classification.intent,
        evidence,
      );
      if (answer) {
        return NextResponse.json(
          buildGroundedReply(answer, classification.intent, evidence, classification.understoodAs),
        );
      }
    } catch (error) {
      console.error("Guide chat Solar fallback:", error);
    }

    return NextResponse.json(safeFallbackFromEvidence(classification, evidence));
  } catch (error) {
    console.error("Guide chat failed:", error);
    return NextResponse.json(
      { error: "답변을 만들지 못했어요. 잠시 후 다시 물어봐 주세요." },
      { status: 500 },
    );
  }
}
