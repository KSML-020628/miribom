import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { parseDocument } from "@/app/lib/upstage";
import { extractDocument, fallbackExtract, mergeExtractions, verifyExtractionSources } from "@/app/lib/information-extract";
import { validateUploadedDocument } from "@/app/lib/document-validation";
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
      documentId: string;
      sourceFileName: string;
    }> = [];
    const failedFiles: string[] = [];
    for (const [fileIndex, file] of files.entries()) {
      const context = {
        documentId: `DOC-${String(fileIndex + 1).padStart(3, "0")}`,
        sourceFileName: file.name,
        sourceFileIndex: fileIndex,
      };
      let pages: ParsedPage[];
      try {
        pages = await parseDocument(file);
      } catch (parseError) {
        console.error(`Document Parse failed for ${file.name}:`, parseError);
        failedFiles.push(file.name);
        continue;
      }

      // 문서의 성격을 먼저 검사해 비의료 문서가 Solar/Information Extract로 넘어가지 않게 합니다.
      const preflightValidation = validateUploadedDocument(pages);
      if (preflightValidation.status === "UNSUPPORTED_DOCUMENT") {
        return NextResponse.json(
          {
            error: "검사 준비 안내문이 아니에요.\n병원에서 받은 검사·시술·수술 전 안내문을 다시 올려 주세요.",
            validationStatus: preflightValidation.status,
          },
          { status: 422 },
        );
      }
      if (preflightValidation.status === "UNREADABLE_DOCUMENT") {
        return NextResponse.json(
          {
            error: "글자를 읽기 어려워요.\n종이 전체가 보이도록 밝은 곳에서 다시 찍어 주세요.",
            validationStatus: preflightValidation.status,
          },
          { status: 422 },
        );
      }

      let extraction: Awaited<ReturnType<typeof extractDocument>>;
      try {
        extraction = verifyExtractionSources(await extractDocument(file, "", context), pages);
      } catch (extractError) {
        console.error("Information Extract fallback:", extractError);
        extraction = fallbackExtract(pages, context);
      }
      const validation = validateUploadedDocument(pages, extraction);
      if (preflightValidation.status === "LOW_CONFIDENCE" || validation.status === "LOW_CONFIDENCE") {
        extraction.warnings.push("검사 준비 안내문인지 확실하지 않아요. 확인 화면에서 문서 내용을 확인해 주세요.");
      }
      fileResults.push({
        pages,
        extraction,
        documentId: context.documentId,
        sourceFileName: context.sourceFileName,
      });
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
          documentId: result.documentId,
          sourceFileName: result.sourceFileName,
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
