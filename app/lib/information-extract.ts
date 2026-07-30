import { parsedPageText, serializeParsedPages } from "./parsed-pages";
import {
  buildProcedureGroups,
  combinedProcedureName,
  detectInstructionConflicts,
  mergeDuplicateInstructions,
  procedureName,
} from "./document-merge";
import {
  ACTION_IDS,
  CONDITION_IDS,
  type ActionId,
  type AppointmentPeriod,
  type ConditionId,
  type DocumentRole,
  type ExtractedDocument,
  type ExtractedInstruction,
  type ExtractionPayload,
  type Importance,
  type ParsedPage,
  type ProcedureId,
} from "./types";
import { fetchUpstage } from "./upstage-fetch";

const INFORMATION_EXTRACT_URL = "https://api.upstage.ai/v1/information-extraction/chat/completions";
const CONDITION_SET = new Set<string>(CONDITION_IDS);
const ACTION_SET = new Set<string>(ACTION_IDS);
const IMPORTANCE_SET = new Set(["required", "caution", "ask_hospital", "information"]);
const APPLICABILITY_SET = new Set(["all", "conditional", "confirm_with_hospital"]);
const PROCEDURE_SET = new Set<ProcedureId>([
  "GASTROSCOPY", "COLONOSCOPY", "BLOOD_TEST", "OTHER_PROCEDURE", "UNKNOWN_PROCEDURE",
]);
const DOCUMENT_ROLE_SET = new Set<DocumentRole>([
  "GENERAL_PREPARATION", "BOWEL_PREP_REGIMEN", "MEDICATION_GUIDE",
  "SCHEDULE_GUIDE", "OTHER_GUIDE", "UNKNOWN_ROLE",
]);
const APPOINTMENT_PERIOD_SET = new Set<AppointmentPeriod>(["morning", "afternoon", "unknown"]);

export interface ExtractionContext {
  documentId: string;
  sourceFileName: string;
  sourceFileIndex: number;
}

function getApiKey(): string {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  return apiKey;
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    document: {
      // Information Extract는 최상위 중첩 object를 허용하지 않으므로 문서 1개를 배열 1항목으로 받는다.
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          document_type: { type: "string", description: "검사 전 안내, 시술 전 안내 등 문서 종류. 불명확하면 확인 필요" },
          procedure_id: {
            type: "string",
            enum: ["GASTROSCOPY", "COLONOSCOPY", "BLOOD_TEST", "OTHER_PROCEDURE", "UNKNOWN_PROCEDURE"],
            description: "이 문서가 직접 안내하는 검사. 장정결제 문서는 COLONOSCOPY",
          },
          procedure_name: { type: "string", description: "검사 또는 시술 이름. 추측 금지" },
          document_role: {
            type: "string",
            enum: ["GENERAL_PREPARATION", "BOWEL_PREP_REGIMEN", "MEDICATION_GUIDE", "SCHEDULE_GUIDE", "OTHER_GUIDE", "UNKNOWN_ROLE"],
            description: "일반 준비인지, 구체적인 장정결제 복용 일정인지 구분",
          },
          hospital_name: { type: "string", description: "병원 이름" },
          procedure_date: { type: "string", description: "실제 검사 날짜. 문서 출력 시각과 구분하고 불명확하면 빈 문자열" },
          appointment_time: { type: "string", description: "실제 예약 시간. 문서 출력 시각과 구분하고 불명확하면 빈 문자열" },
          appointment_period: { type: "string", enum: ["morning", "afternoon", "unknown"] },
          hospital_phone: { type: "string", description: "문의 전화번호" },
          regimen_name: { type: "string", description: "오라팡정 등 장정결제 이름. 없으면 빈 문자열" },
        },
        required: [
          "document_type", "procedure_id", "procedure_name", "document_role", "hospital_name",
          "procedure_date", "appointment_time", "appointment_period", "hospital_phone", "regimen_name",
        ],
      },
    },
    instructions: {
      type: "array",
      description: "환자가 실제로 해야 하거나 확인해야 하는 지시. 한 항목에 행동 하나만 넣고, 한 문장에 행동이 두 개면 두 항목으로 분리",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          instruction_id: { type: "string", description: "I-001 형식의 고유 ID" },
          source_page: { type: "integer", minimum: 1, description: "근거가 있는 페이지 번호" },
          source_text: { type: "string", description: "근거가 된 원문을 바꾸거나 요약하지 말고 그대로 인용" },
          applicability: { type: "string", enum: ["all", "conditional", "confirm_with_hospital"], description: "모든 사람, 특정 조건, 병원 확인 필요 중 하나" },
          condition_id: { type: "string", enum: CONDITION_IDS, description: "허용 목록에서만 선택. 공통 지시는 NO_CONDITION, 맞는 것이 없으면 UNKNOWN_CONDITION" },
          condition_value: { type: "string", description: "yes, no, morning, afternoon, one, two_or_more 등 원문 조건값. 없으면 빈 문자열" },
          action_id: { type: "string", enum: ACTION_IDS, description: "행동 의미에 맞는 허용 ID. 맞는 것이 없으면 OTHER_ACTION" },
          when_stage: { type: "string", description: "검사 3일 전, 검사 전날, 검사 당일, 검사 후 등" },
          when_time: { type: "string", description: "원문에 적힌 구체적인 시각. 추측 금지" },
          object: { type: "string", description: "음식, 물, 약 이름, 흰죽 등 행동 대상" },
          method: { type: "string", description: "1~2정씩 나누기 등 구체적인 방법. 없으면 빈 문자열" },
          amount: { type: "string", description: "14정, 300mL, 1L 이상 등 원문 수량. 없으면 빈 문자열" },
          duration: { type: "string", description: "30분, 1시간 등 원문 지속 시간. 없으면 빈 문자열" },
          importance: { type: "string", enum: ["required", "caution", "ask_hospital", "information"] },
          requires_user_question: { type: "boolean", description: "답변에 따라 실제 최종 지시가 달라질 때만 true" },
        },
        required: [
          "instruction_id", "source_page", "source_text", "applicability", "condition_id", "condition_value",
          "action_id", "when_stage", "when_time", "object", "method", "amount", "duration",
          "importance", "requires_user_question",
        ],
      },
    },
  },
  required: ["document", "instructions"],
} as const;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s·•▶※★◆◇■□|_*#()[\]{}<>,.:;'"`~!?/\\-]+/g, "");
}

function normalizeStage(value: unknown): string {
  const stage = asString(value).replace(/\s+/g, " ").trim();
  if (/^(?:검사\s*)?3일\s*전$/.test(stage) || stage === "3일전") return "검사 3일 전";
  if (/처방\s*당일|검사\s*전\s*확인/.test(stage)) return "지금 확인";
  return stage;
}

function bigrams(text: string): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

function sourceSimilarity(sourceText: string, parsedText: string): number {
  const source = normalizeText(sourceText);
  const parsed = normalizeText(parsedText);
  if (!source || !parsed) return 0;
  if (parsed.includes(source) || source.includes(parsed)) return 1;
  const sourcePairs = bigrams(source);
  const parsedPairs = bigrams(parsed);
  let overlap = 0;
  sourcePairs.forEach((pair) => { if (parsedPairs.has(pair)) overlap += 1; });
  return (2 * overlap) / Math.max(1, sourcePairs.size + parsedPairs.size);
}

function allowedProcedureId(value: unknown): ProcedureId {
  return typeof value === "string" && PROCEDURE_SET.has(value as ProcedureId)
    ? value as ProcedureId
    : "UNKNOWN_PROCEDURE";
}

function allowedDocumentRole(value: unknown): DocumentRole {
  return typeof value === "string" && DOCUMENT_ROLE_SET.has(value as DocumentRole)
    ? value as DocumentRole
    : "UNKNOWN_ROLE";
}

function allowedAppointmentPeriod(value: unknown): AppointmentPeriod {
  return typeof value === "string" && APPOINTMENT_PERIOD_SET.has(value as AppointmentPeriod)
    ? value as AppointmentPeriod
    : "unknown";
}

function inferProcedureId(text: string): ProcedureId {
  const normalized = text.normalize("NFKC");
  if (/대장\s*내시경|대장검사|장정결|장\s*청소약|오라팡|쿨프렙/.test(normalized)) return "COLONOSCOPY";
  if (/위\s*내시경|위내시경/.test(normalized)) return "GASTROSCOPY";
  if (/혈액\s*검사|피\s*검사|채혈/.test(normalized)) return "BLOOD_TEST";
  return "UNKNOWN_PROCEDURE";
}

function inferDocumentRole(text: string): DocumentRole {
  const normalized = text.normalize("NFKC");
  const heading = normalized.slice(0, 500);
  if (
    /(?:오라팡|쿨프렙|장정결제)[\s\S]{0,40}(?:복약|복용)\s*안내/.test(heading)
    || /(?:복약|복용)\s*안내[\s\S]{0,40}(?:오라팡|쿨프렙|장정결제)/.test(heading)
  ) return "BOWEL_PREP_REGIMEN";
  if (/약\s*(?:복용|확인|중단).*안내|복약\s*안내/.test(heading)) return "MEDICATION_GUIDE";
  if (/시간표|일정\s*안내/.test(heading)) return "SCHEDULE_GUIDE";
  if (/검사\s*안내|준비\s*안내/.test(heading)) return "GENERAL_PREPARATION";
  return "UNKNOWN_ROLE";
}

function inferAppointmentPeriod(text: string): AppointmentPeriod {
  const heading = text.slice(0, 700);
  if (/오후\s*검사[\s\S]{0,20}(?:복약|복용)\s*안내/.test(heading)) return "afternoon";
  if (/오전\s*검사[\s\S]{0,20}(?:복약|복용)\s*안내/.test(heading)) return "morning";
  const hasMorning = /오전\s*검사/.test(text);
  const hasAfternoon = /오후\s*검사/.test(text);
  if (hasMorning !== hasAfternoon) return hasMorning ? "morning" : "afternoon";
  return "unknown";
}

function inferRegimenName(text: string): string {
  if (/오라팡/.test(text)) return "오라팡정";
  if (/쿨프렙/.test(text)) return "쿨프렙";
  return "";
}

function buildExtractedDocument(
  value: Record<string, unknown>,
  parsedText: string,
  context: ExtractionContext,
  pageCount: number | null,
): ExtractedDocument {
  const textForClassification = `${asString(value.procedure_name)}\n${parsedText}`;
  const inferredProcedure = inferProcedureId(textForClassification);
  const procedureId = inferredProcedure !== "UNKNOWN_PROCEDURE"
    ? inferredProcedure
    : allowedProcedureId(value.procedure_id);
  const inferredRole = inferDocumentRole(parsedText);
  const documentRole = inferredRole !== "UNKNOWN_ROLE"
    ? inferredRole
    : allowedDocumentRole(value.document_role);
  const inferredPeriod = inferAppointmentPeriod(parsedText);
  const appointmentPeriod = inferredPeriod !== "unknown"
    ? inferredPeriod
    : allowedAppointmentPeriod(value.appointment_period);
  const regimenName = inferRegimenName(parsedText) || asString(value.regimen_name);
  return {
    document_id: context.documentId,
    source_file_name: context.sourceFileName,
    source_file_index: context.sourceFileIndex,
    document_type: asString(value.document_type) || "확인 필요",
    procedure_id: procedureId,
    procedure_name: procedureName(procedureId, asString(value.procedure_name)),
    document_role: documentRole,
    hospital_name: asString(value.hospital_name),
    procedure_date: asString(value.procedure_date),
    appointment_time: asString(value.appointment_time),
    appointment_period: appointmentPeriod,
    hospital_phone: asString(value.hospital_phone),
    regimen_name: regimenName,
    page_count: pageCount,
    source_reliability: "partially_unclear",
  };
}

function normalizeInstruction(
  value: unknown,
  index: number,
  parsedText: string,
  document: ExtractedDocument,
): ExtractedInstruction | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const sourceText = asString(item.source_text);
  const conditionId = asString(item.condition_id);
  const actionId = asString(item.action_id);
  const applicability = asString(item.applicability);
  const importance = asString(item.importance);
  if (!sourceText || !CONDITION_SET.has(conditionId) || !ACTION_SET.has(actionId) || !APPLICABILITY_SET.has(applicability)) return null;
  const similarity = sourceSimilarity(sourceText, parsedText);
  return {
    instruction_id: asString(item.instruction_id) || `I-${String(index + 1).padStart(3, "0")}`,
    document_id: document.document_id,
    procedure_id: document.procedure_id,
    document_role: document.document_role,
    source_file_name: document.source_file_name,
    source_page: typeof item.source_page === "number" && item.source_page > 0 ? Math.floor(item.source_page) : 1,
    source_text: sourceText,
    source_document_ids: [document.document_id],
    applicability: applicability as ExtractedInstruction["applicability"],
    condition_id: conditionId as ConditionId,
    condition_value: asString(item.condition_value),
    action_id: actionId as ActionId,
    when_stage: normalizeStage(item.when_stage),
    when_time: asString(item.when_time),
    object: asString(item.object),
    method: asString(item.method),
    amount: asString(item.amount),
    duration: asString(item.duration),
    importance: (IMPORTANCE_SET.has(importance) ? importance : "information") as Importance,
    requires_user_question: item.requires_user_question === true,
    source_verified: similarity >= 0.72,
    source_similarity: Number(similarity.toFixed(3)),
  };
}

function applyDeterministicContext(
  instructions: ExtractedInstruction[],
  parsedText: string,
): ExtractedInstruction[] {
  return instructions.map((instruction) => {
    let corrected = instruction;

    // 약 개수에 따른 분기 근거가 있을 때만 COUNT를 쓰고, 일반적인 복용 여부는 USE로 묻는다.
    if (
      (instruction.condition_id === "BLOOD_THINNER_COUNT" || instruction.condition_id === "BLOOD_THINNER_USE")
      && !/(?:1|한)\s*가지|(?:2|두)\s*가지|두\s*종류|복합\s*약/.test(instruction.source_text)
    ) {
      corrected = {
        ...corrected,
        condition_id: "BLOOD_THINNER_USE",
        condition_value: "yes",
      };
    }

    // "장을 비우는 약을 구입"은 복용 지시가 아니라 준비 여부를 묻는 근거다.
    if (/장\s*정결제.{0,30}구입|구입.{0,30}장\s*정결제/.test(instruction.source_text)) {
      corrected = {
        ...corrected,
        applicability: "conditional",
        condition_id: "BOWEL_PREP_READY",
        condition_value: "no",
        action_id: "OTHER_ACTION",
        requires_user_question: true,
      };
    }

    // 장정결 일정표 안의 물 복용 단계는 일반 약 복용이 아니라 장정결 과정으로 표시한다.
    if (
      instruction.document_role === "BOWEL_PREP_REGIMEN"
      && instruction.action_id === "TAKE_MEDICINE"
      && /물|생수/.test(`${instruction.object} ${instruction.source_text}`)
    ) {
      corrected = {
        ...corrected,
        action_id: "TAKE_BOWEL_PREP",
      };
    }

    // Document Parse의 표 셀 순서가 뒤섞여도 '죽' 안내와 위 수술 조건을 같은 문맥으로 묶는다.
    if (instruction.action_id === "EAT_PORRIDGE" && instruction.condition_id === "NO_CONDITION") {
      const sourceIndex = parsedText.indexOf(instruction.source_text);
      const nearby = sourceIndex >= 0
        ? parsedText.slice(Math.max(0, sourceIndex - 180), sourceIndex + instruction.source_text.length + 220)
        : "";
      if (/위\s*절제술|위\s*수술/.test(nearby)) {
        corrected = {
          ...corrected,
          applicability: "conditional",
          condition_id: "GASTRECTOMY_HISTORY",
          condition_value: "yes",
          requires_user_question: true,
        };
      }
    }

    // 알려진 개인화 조건은 모델의 질문 여부 플래그와 무관하게 반드시 고정 질문으로 확인한다.
    if (corrected.condition_id !== "NO_CONDITION" && corrected.condition_id !== "UNKNOWN_CONDITION") {
      corrected = {
        ...corrected,
        applicability: "conditional",
        requires_user_question: true,
      };
    }

    return corrected;
  });
}

export async function extractDocument(
  file: File,
  parsedText: string,
  context: ExtractionContext,
): Promise<ExtractionPayload> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`;
  const response = await fetchUpstage(INFORMATION_EXTRACT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "information-extract",
      messages: [{
        role: "user",
        content: [{ type: "image_url", image_url: { url: dataUrl } }],
      }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "miribom_medical_instruction_schema",
          schema: extractionSchema,
        },
      },
    }),
  // 구조화 추출은 한 번만 시도하고 35초 안에 끝나지 않으면 Parse 기반 안전 복구로 전환한다.
  }, { timeoutMs: 35_000, retries: 0, operation: "information_extract" });

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Information Extract 결과가 비어 있습니다.");
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "").trim()) as Record<string, unknown>;
  const documentValue = Array.isArray(parsed.document) && parsed.document[0] && typeof parsed.document[0] === "object"
    ? parsed.document[0] as Record<string, unknown>
    : {};
  const extractedDocument = buildExtractedDocument(documentValue, parsedText, context, null);
  const normalizedInstructions = (Array.isArray(parsed.instructions) ? parsed.instructions : [])
    .map((item, index) => normalizeInstruction(item, index, parsedText, extractedDocument))
    .filter((item): item is ExtractedInstruction => Boolean(item));
  const instructions = applyDeterministicContext(normalizedInstructions, parsedText);
  const unverified = instructions.filter((item) => !item.source_verified).length;

  return {
    document: {
      document_type: extractedDocument.document_type,
      procedure_id: extractedDocument.procedure_id,
      procedure_name: extractedDocument.procedure_name,
      hospital_name: extractedDocument.hospital_name,
      procedure_date: extractedDocument.procedure_date,
      appointment_time: extractedDocument.appointment_time,
      hospital_phone: extractedDocument.hospital_phone,
      document_count: 1,
    },
    documents: [extractedDocument],
    procedures: buildProcedureGroups([extractedDocument]),
    instructions,
    conflicts: [],
    mode: "information-extract",
    warnings: unverified ? [`원문 근거를 확인하지 못한 ${unverified}개 항목은 자동 적용하지 않았어요.`] : [],
  };
}

export function verifyExtractionSources(extraction: ExtractionPayload, pages: ParsedPage[]): ExtractionPayload {
  const parsedText = serializeParsedPages(pages);
  const originalDocument = extraction.documents[0];
  const document = buildExtractedDocument(
    {
      document_type: originalDocument?.document_type,
      procedure_id: originalDocument?.procedure_id,
      procedure_name: originalDocument?.procedure_name,
      document_role: originalDocument?.document_role,
      hospital_name: originalDocument?.hospital_name,
      procedure_date: originalDocument?.procedure_date,
      appointment_time: originalDocument?.appointment_time,
      appointment_period: originalDocument?.appointment_period,
      hospital_phone: originalDocument?.hospital_phone,
      regimen_name: originalDocument?.regimen_name,
    },
    parsedText,
    {
      documentId: originalDocument?.document_id || "DOC-001",
      sourceFileName: originalDocument?.source_file_name || "",
      sourceFileIndex: originalDocument?.source_file_index || 0,
    },
    pages.length,
  );
  let unverified = 0;
  const correctedInstructions = applyDeterministicContext(extraction.instructions, parsedText);
  const mappedInstructions = correctedInstructions.map((instruction) => {
    const pageScores = pages.map((page) => ({
      pageNumber: page.pageNumber,
      similarity: sourceSimilarity(instruction.source_text, parsedPageText(page)),
    })).sort((a, b) => b.similarity - a.similarity);
    const bestPage = pageScores[0];
    const similarity = bestPage?.similarity || 0;
    const sourceVerified = similarity >= 0.72;
    if (!sourceVerified) unverified += 1;
    return {
      ...instruction,
      document_id: document.document_id,
      procedure_id: document.procedure_id,
      document_role: document.document_role,
      source_file_name: document.source_file_name,
      source_document_ids: [document.document_id],
      // 모델의 페이지 번호보다 실제 Parse 블록에서 근거 문장이 발견된 페이지를 우선한다.
      source_page: sourceVerified
        ? bestPage.pageNumber
        : Math.min(pages.length, Math.max(1, instruction.source_page)),
      source_verified: sourceVerified,
      source_similarity: Number(similarity.toFixed(3)),
    };
  });
  // Parse 본문으로 확정한 문서 역할을 instruction에 연결한 뒤 역할 의존 규칙을 한 번 더 적용한다.
  const instructions = applyDeterministicContext(mappedInstructions, parsedText);
  document.source_reliability = unverified ? "partially_unclear" : "clear";
  return {
    ...extraction,
    document: {
      ...extraction.document,
      procedure_id: document.procedure_id,
      procedure_name: document.procedure_name,
      document_count: 1,
    },
    documents: [document],
    procedures: buildProcedureGroups([document]),
    instructions,
    warnings: [
      ...extraction.warnings.filter((warning) => !warning.includes("원문 근거")),
      ...(unverified ? [`원문 근거를 확인하지 못한 ${unverified}개 항목은 자동 적용하지 않았어요.`] : []),
    ],
  };
}

function classifyCondition(text: string): ConditionId {
  if (/위\s*(절제|수술)/.test(text)) return "GASTRECTOMY_HISTORY";
  if (/항혈|항응고|아스피린|와파린|피.*멎/.test(text)) {
    return /(?:1|한)\s*가지|(?:2|두)\s*가지|복합\s*약/.test(text)
      ? "BLOOD_THINNER_COUNT"
      : "BLOOD_THINNER_USE";
  }
  if (/혈압약|고혈압.*약/.test(text)) return "BLOOD_PRESSURE_MEDICINE";
  if (/당뇨약|인슐린/.test(text)) return "DIABETES_MEDICINE";
  if (/수면|진정/.test(text)) return "SEDATION";
  if (/보호자|동반/.test(text)) return "GUARDIAN_AVAILABLE";
  if (/오전.*검사|오후.*검사|예약\s*시간/.test(text)) return "APPOINTMENT_PERIOD";
  if (/장정결|장\s*청소약|관장약/.test(text)) return "BOWEL_PREP_READY";
  if (/치아|틀니|흔들리는\s*이/.test(text)) return "DENTAL_RISK";
  return "NO_CONDITION";
}

function classifyAction(text: string): ActionId {
  if (/금식|먹지\s*마|음식.*안\s*됩/.test(text)) return "NO_FOOD";
  if (/물.*(중단|마시지|안\s*됩)/.test(text)) return "NO_WATER";
  if (/죽/.test(text)) return "EAT_PORRIDGE";
  if (/장정결|장\s*청소약|관장약/.test(text)) return "TAKE_BOWEL_PREP";
  if (/운전.*(금지|하지)/.test(text)) return "NO_DRIVING";
  if (/보호자|동반/.test(text)) return "COME_WITH_GUARDIAN";
  if (/치아|틀니/.test(text)) return "CHECK_TEETH";
  if (/병원.*(문의|확인)|의사.*상의|약국.*문의/.test(text)) return "ASK_PRESCRIBER";
  if (/약.*(먹|드|복용)/.test(text)) return "TAKE_MEDICINE";
  if (/병원.*(오|도착)|내원/.test(text)) return "HOSPITAL_ARRIVAL";
  if (/시간|시각|예약/.test(text)) return "CHECK_TIME";
  return "OTHER_ACTION";
}

export function fallbackExtract(pages: ParsedPage[], context: ExtractionContext): ExtractionPayload {
  const parsedText = serializeParsedPages(pages);
  const candidates = pages.flatMap((page) =>
    parsedPageText(page)
      .split(/\n+/)
      .map((line) => line.replace(/^[#>*|\-\s]+/, "").trim())
      .filter((line) => line.length >= 8)
      .filter((line) =>
        /금식|물|죽|약|장정결|보호자|운전|치아|틀니|병원|내원|예약|검사\s*(전|당일|후)/.test(line),
      )
      .map((line) => ({ line, pageNumber: page.pageNumber })),
  ).slice(0, 24);
  const instructions = candidates.map(({ line, pageNumber }, index): ExtractedInstruction => {
    const conditionId = classifyCondition(line);
    const actionId = classifyAction(line);
    const confirm = conditionId === "BLOOD_THINNER_COUNT" || conditionId === "BLOOD_THINNER_USE" || /문의|확인|상의/.test(line);
    return {
      instruction_id: `F-${String(index + 1).padStart(3, "0")}`,
      document_id: context.documentId,
      procedure_id: "UNKNOWN_PROCEDURE",
      document_role: "UNKNOWN_ROLE",
      source_file_name: context.sourceFileName,
      source_page: pageNumber,
      source_text: line,
      source_document_ids: [context.documentId],
      applicability: confirm ? "confirm_with_hospital" : conditionId === "NO_CONDITION" ? "all" : "conditional",
      condition_id: conditionId,
      condition_value: conditionId === "NO_CONDITION" ? "" : "yes",
      action_id: actionId,
      when_stage: /전날/.test(line) ? "검사 전날" : /당일/.test(line) ? "검사 당일" : "",
      when_time: line.match(/(?:오전|오후|밤|저녁|아침)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/)?.[0] || "",
      object: "",
      method: "",
      amount: line.match(/\d+(?:\s*[~～-]\s*\d+)?\s*(?:정|mL|ml|cc|L|ℓ|컵)(?:\s*이상)?/)?.[0] || "",
      duration: line.match(/\d+\s*(?:분|시간)/)?.[0] || "",
      importance: confirm ? "ask_hospital" : /금지|안\s*됩|반드시|필수/.test(line) ? "required" : "information",
      requires_user_question: conditionId !== "NO_CONDITION",
      source_verified: true,
      source_similarity: 1,
    };
  }).filter((item) => item.action_id !== "OTHER_ACTION" || item.condition_id !== "NO_CONDITION");

  const extractedDocument = buildExtractedDocument(
    {
      document_type: "검사 전 안내",
      hospital_phone: parsedText.match(/\d{2,4}-\d{3,4}-\d{4}/)?.[0] || "",
    },
    parsedText,
    context,
    pages.length,
  );
  instructions.forEach((instruction) => {
    instruction.procedure_id = extractedDocument.procedure_id;
    instruction.document_role = extractedDocument.document_role;
  });
  const phone = parsedText.match(/\d{2,4}-\d{3,4}-\d{4}/)?.[0] || "";
  return {
    document: {
      document_type: "검사 전 안내",
      procedure_id: extractedDocument.procedure_id,
      procedure_name: extractedDocument.procedure_name,
      hospital_name: "",
      procedure_date: "",
      appointment_time: "",
      hospital_phone: phone,
      document_count: 1,
    },
    documents: [extractedDocument],
    procedures: buildProcedureGroups([extractedDocument]),
    instructions,
    conflicts: [],
    mode: "fallback",
    warnings: ["구조화 추출 연결이 불안정해 원문 키워드로 최소한의 질문만 만들었어요. 결과를 병원 안내문과 함께 확인해 주세요."],
  };
}

interface ExtractionPart {
  extraction: ExtractionPayload;
  pageOffset: number;
  pageCount: number;
}

export function mergeExtractions(parts: ExtractionPart[]): ExtractionPayload {
  const items = parts.map((part) => part.extraction);
  const firstValue = (field: "document_type" | "hospital_name" | "procedure_date" | "appointment_time" | "hospital_phone") =>
    items.map((item) => item.document[field]).find((value) => typeof value === "string" && value) as string || "";
  const documents = parts.flatMap((part) => part.extraction.documents);
  const procedures = buildProcedureGroups(documents);
  const rawInstructions = parts.flatMap((part, fileIndex) =>
    part.extraction.instructions.map((instruction) => ({
      ...instruction,
      instruction_id: `D${fileIndex + 1}-${instruction.instruction_id}`,
      source_page: part.pageOffset
        + Math.min(part.pageCount, Math.max(1, instruction.source_page)),
    })),
  );
  const mergedInstructions = mergeDuplicateInstructions(rawInstructions);
  const conflicts = detectInstructionConflicts(documents, mergedInstructions);
  const conflictingIds = new Set(conflicts.flatMap((conflict) => conflict.instruction_ids));
  const instructions = mergedInstructions.map((instruction) => conflictingIds.has(instruction.instruction_id)
    ? {
        ...instruction,
        applicability: "confirm_with_hospital" as const,
        importance: "ask_hospital" as const,
        requires_user_question: false,
      }
    : instruction);
  const fallbackCount = items.filter((item) => item.mode === "fallback").length;
  const aggregateProcedureName = combinedProcedureName(procedures);
  const singleProcedure = procedures.length === 1 ? procedures[0] : undefined;
  const appointmentPeriod = singleProcedure?.appointment_period;
  return {
    document: {
      document_type: firstValue("document_type"),
      procedure_id: singleProcedure?.procedure_id,
      procedure_name: aggregateProcedureName,
      hospital_name: firstValue("hospital_name"),
      procedure_date: firstValue("procedure_date"),
      appointment_time: firstValue("appointment_time")
        || (appointmentPeriod === "morning" ? "오전" : appointmentPeriod === "afternoon" ? "오후" : ""),
      hospital_phone: firstValue("hospital_phone"),
      document_count: documents.length,
    },
    documents,
    procedures,
    instructions,
    conflicts,
    mode: fallbackCount === 0 ? "information-extract" : fallbackCount === items.length ? "fallback" : "mixed",
    warnings: [
      ...new Set(items.flatMap((item) => item.warnings)),
      ...conflicts.map((conflict) => conflict.summary),
    ],
  };
}
