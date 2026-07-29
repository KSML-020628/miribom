import { NextResponse } from "next/server";
import { parseDocument } from "@/app/lib/upstage";
import { extractDocument, fallbackExtract, mergeExtractions, verifyExtractionSources } from "@/app/lib/information-extract";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = [
      ...formData.getAll("documents"),
      ...formData.getAll("document"),
    ].filter((value): value is File => value instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "안내문 사진이나 PDF를 선택해 주세요." }, { status: 400 });
    }
    if (files.length > 10) {
      return NextResponse.json({ error: "안내문은 한 번에 10장까지 올릴 수 있어요." }, { status: 400 });
    }
    if (files.some((file) => !ACCEPTED_TYPES.has(file.type))) {
      return NextResponse.json({ error: "JPG, PNG, WEBP 또는 PDF만 올릴 수 있어요." }, { status: 415 });
    }
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      return NextResponse.json({ error: "파일 한 장의 크기는 20MB 이하여야 해요." }, { status: 413 });
    }

    const pageResults = await Promise.all(files.map(async (file) => {
      // 두 서비스는 서로 독립적이므로 동시에 실행해 전체 대기 시간을 줄입니다.
      const [parseResult, extractResult] = await Promise.allSettled([
        parseDocument(file),
        extractDocument(file, ""),
      ]);
      if (parseResult.status === "rejected") throw parseResult.reason;
      const parsedText = parseResult.value;
      const extraction = extractResult.status === "fulfilled"
        ? verifyExtractionSources(extractResult.value, parsedText)
        : fallbackExtract(parsedText, 1);
      if (extractResult.status === "rejected") {
        console.error("Information Extract fallback:", extractResult.reason);
      }
      return { parsedText, extraction };
    }));
    const content = pageResults.map((page, index) => `\n\n--- 안내문 ${index + 1}쪽 ---\n${page.parsedText}`).join("");
    const extraction = mergeExtractions(pageResults.map((page) => page.extraction), files.length);
    return NextResponse.json({ content, pageCount: files.length, extraction });
  } catch (error) {
    console.error("Document parse failed:", error);
    return NextResponse.json(
      { error: "안내문을 읽지 못했어요. 글자가 잘 보이게 다시 찍어주세요." },
      { status: 502 },
    );
  }
}
