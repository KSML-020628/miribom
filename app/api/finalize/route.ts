import { NextResponse } from "next/server";
import { buildFinalGuide } from "@/app/lib/guide-generator";
import type { DocumentSummary, ExtractedInstruction, PersonalizationQuestion } from "@/app/lib/types";

export const runtime = "nodejs";
export const maxDuration = 75;

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      document?: unknown;
      questions?: unknown;
      instructions?: unknown;
      answers?: unknown;
    };
    if (
      !body.document || typeof body.document !== "object" ||
      !Array.isArray(body.questions) ||
      !Array.isArray(body.instructions) ||
      !body.answers || typeof body.answers !== "object"
    ) {
      return NextResponse.json({ error: "맞춤 안내서를 만들 정보가 부족해요." }, { status: 400 });
    }
    const guide = await buildFinalGuide(
      body.document as DocumentSummary,
      body.questions as PersonalizationQuestion[],
      body.instructions as ExtractedInstruction[],
      body.answers as Record<string, string>,
    );
    return NextResponse.json(guide);
  } catch (error) {
    console.error("Guide generation failed:", error);
    return NextResponse.json(
      { error: "쉬운 안내서를 만들지 못했어요. 원문 안내를 확인하거나 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
