import { NextResponse } from "next/server";
import { buildAnalysisFromExtraction } from "@/app/lib/personalization";
import type { ExtractionPayload } from "@/app/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { extraction?: unknown; pageCount?: unknown };
    if (!body.extraction || typeof body.extraction !== "object") {
      return NextResponse.json({ error: "구조화된 안내문 정보가 없어요." }, { status: 400 });
    }
    const pageCount = typeof body.pageCount === "number" ? body.pageCount : 1;
    const analysis = buildAnalysisFromExtraction(body.extraction as ExtractionPayload, pageCount);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Document analysis failed:", error);
    return NextResponse.json(
      { error: "안내문 조건을 정리하지 못했어요. 안내문을 다시 확인해 주세요." },
      { status: 500 },
    );
  }
}
