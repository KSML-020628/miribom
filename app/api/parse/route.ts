import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { parseDocument } from "@/app/lib/upstage";
import { extractDocument, fallbackExtract, mergeExtractions, verifyExtractionSources } from "@/app/lib/information-extract";
import type { ParsedPage } from "@/app/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

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

    const fileResults: Array<{
      pages: ParsedPage[];
      extraction: Awaited<ReturnType<typeof extractDocument>>;
    }> = [];
    const failedFiles: string[] = [];
    for (const [fileIndex, file] of files.entries()) {
      const context = {
        documentId: `DOC-${String(fileIndex + 1).padStart(3, "0")}`,
        sourceFileName: file.name,
        sourceFileIndex: fileIndex,
      };
      // 두 서비스는 서로 독립적이므로 동시에 실행해 전체 대기 시간을 줄입니다.
      const [parseResult, extractResult] = await Promise.allSettled([
        parseDocument(file),
        extractDocument(file, "", context),
      ]);
      if (parseResult.status === "rejected") {
        console.error(`Document Parse failed for ${file.name}:`, parseResult.reason);
        failedFiles.push(file.name);
        continue;
      }
      const pages = parseResult.value;
      const extraction = extractResult.status === "fulfilled"
        ? verifyExtractionSources(extractResult.value, pages)
        : fallbackExtract(pages, context);
      if (extractResult.status === "rejected") {
        console.error("Information Extract fallback:", extractResult.reason);
      }
      fileResults.push({ pages, extraction });
    }
    if (!fileResults.length) throw new Error("올린 안내문을 모두 읽지 못했습니다.");

    let pageOffset = 0;
    const pages: ParsedPage[] = [];
    const extractionParts = fileResults.map((result) => {
      const currentOffset = pageOffset;
      result.pages.forEach((page, index) => {
        pages.push({
          ...page,
          pageNumber: currentOffset + index + 1,
        });
      });
      pageOffset += result.pages.length;
      return {
        extraction: result.extraction,
        pageOffset: currentOffset,
        pageCount: result.pages.length,
      };
    });
    const extraction = mergeExtractions(extractionParts);
    if (failedFiles.length) {
      extraction.warnings.push(`${failedFiles.join(", ")} 파일은 읽지 못해 결과에서 제외했어요.`);
    }
    return NextResponse.json({
      documentId: `DOC-${randomUUID()}`,
      pages,
      pageCount: pages.length,
      extraction,
    });
  } catch (error) {
    console.error("Document parse failed:", error);
    return NextResponse.json(
      { error: "안내문을 읽지 못했어요. 글자가 잘 보이게 다시 찍어주세요." },
      { status: 502 },
    );
  }
}
