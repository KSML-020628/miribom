import { parsedPageText } from "./parsed-pages";
import type {
  DocumentValidationStatus,
  ExtractionPayload,
  ParsedPage,
  SupportedDocumentType,
} from "./types";

export interface DocumentValidationResult {
  status: DocumentValidationStatus;
  documentType?: SupportedDocumentType;
  reason: string;
}

const GUIDE_TERMS = [
  "검사 안내", "검사 전", "시술 전", "수술 전", "입원 안내", "퇴원 안내",
  "내시경", "금식", "복용", "장정결", "장 청소", "보호자", "내원", "예약",
];

const MEDICAL_TERMS = [
  "병원", "검사", "시술", "수술", "내시경", "약", "복용", "처방", "환자",
];

const NON_GUIDE_TERMS = [
  "공급가액", "부가세", "승인번호", "결제금액", "사업자등록번호",
  "영수증", "청구금액", "계약서", "광고", "메뉴판",
];

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function classifySupportedType(text: string): SupportedDocumentType {
  if (/퇴원|퇴원 후/.test(text)) return "DISCHARGE_GUIDE";
  if (/입원|입원 전/.test(text)) return "ADMISSION_GUIDE";
  if (/수술/.test(text)) return "PRE_SURGERY_GUIDE";
  if (/시술/.test(text)) return "PRE_PROCEDURE_GUIDE";
  if (/복약|투약|약.*준비|복용 안내/.test(text)) return "MEDICATION_PREPARATION_GUIDE";
  return "PRE_EXAM_GUIDE";
}

/**
 * LLM 호출 결과에 의존하지 않는 1차 문서 품질 게이트입니다.
 * 명확한 비의료 문서와 읽을 수 없는 문서는 즉시 거절하고,
 * 애매한 문서는 사용자 확인 화면까지는 진행합니다.
 */
export function validateUploadedDocument(
  pages: ParsedPage[],
  extraction?: ExtractionPayload,
): DocumentValidationResult {
  const text = pages.map(parsedPageText).join("\n").replace(/\s+/g, " ").trim();
  const meaningfulText = text.replace(/[^\p{L}\p{N}]/gu, "");

  if (meaningfulText.length < 45) {
    return {
      status: "UNREADABLE_DOCUMENT",
      reason: "문서에서 읽을 수 있는 글자가 너무 적습니다.",
    };
  }

  const guideScore = countMatches(text, GUIDE_TERMS);
  const medicalScore = countMatches(text, MEDICAL_TERMS);
  const nonGuideScore = countMatches(text, NON_GUIDE_TERMS);
  const hasInstructions = extraction?.instructions.some((item) => item.source_verified) ?? true;
  const hasKnownProcedure = extraction?.documents.some(
    (item) => item.procedure_id !== "UNKNOWN_PROCEDURE",
  ) ?? true;

  if ((nonGuideScore >= 2 && guideScore === 0) || (medicalScore === 0 && guideScore === 0)) {
    return {
      status: "UNSUPPORTED_DOCUMENT",
      reason: "검사·시술·수술 준비 안내에 해당하는 근거를 찾지 못했습니다.",
    };
  }

  if (guideScore < 2 || (!hasInstructions && !hasKnownProcedure)) {
    return {
      status: "LOW_CONFIDENCE",
      documentType: classifySupportedType(text),
      reason: "검사 준비 안내문인지 사용자의 확인이 필요합니다.",
    };
  }

  return {
    status: "VALID",
    documentType: classifySupportedType(text),
    reason: "지원하는 병원 안내문으로 확인했습니다.",
  };
}
