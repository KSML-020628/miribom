import { parsedPageText, serializeParsedPages } from "./parsed-pages";
import {
  ACTION_IDS,
  CONDITION_IDS,
  type ActionId,
  type ConditionId,
  type ExtractedInstruction,
  type ExtractionPayload,
  type Importance,
  type ParsedPage,
} from "./types";
import { fetchUpstage } from "./upstage-fetch";

const INFORMATION_EXTRACT_URL = "https://api.upstage.ai/v1/information-extraction/chat/completions";
const CONDITION_SET = new Set<string>(CONDITION_IDS);
const ACTION_SET = new Set<string>(ACTION_IDS);
const IMPORTANCE_SET = new Set(["required", "caution", "ask_hospital", "information"]);
const APPLICABILITY_SET = new Set(["all", "conditional", "confirm_with_hospital"]);

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
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
        document_type: { type: "string", description: "검사 전 안내, 시술 전 안내 등 문서 종류. 불명확하면 확인 필요" },
        procedure_name: { type: "string", description: "검사 또는 시술 이름. 추측 금지" },
        hospital_name: { type: "string", description: "병원 이름" },
        procedure_date: { type: "string", description: "실제 검사 날짜. 문서 출력 시각과 구분하고 불명확하면 빈 문자열" },
        appointment_time: { type: "string", description: "실제 예약 시간. 문서 출력 시각과 구분하고 불명확하면 빈 문자열" },
        hospital_phone: { type: "string", description: "문의 전화번호" },
        },
        required: ["document_type", "procedure_name", "hospital_name", "procedure_date", "appointment_time", "hospital_phone"],
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
          importance: { type: "string", enum: ["required", "caution", "ask_hospital", "information"] },
          requires_user_question: { type: "boolean", description: "답변에 따라 실제 최종 지시가 달라질 때만 true" },
        },
        required: [
          "instruction_id", "source_page", "source_text", "applicability", "condition_id", "condition_value",
          "action_id", "when_stage", "when_time", "object", "importance", "requires_user_question",
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

function normalizeInstruction(value: unknown, index: number, parsedText: string): ExtractedInstruction | null {
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
    source_page: typeof item.source_page === "number" && item.source_page > 0 ? Math.floor(item.source_page) : 1,
    source_text: sourceText,
    applicability: applicability as ExtractedInstruction["applicability"],
    condition_id: conditionId as ConditionId,
    condition_value: asString(item.condition_value),
    action_id: actionId as ActionId,
    when_stage: asString(item.when_stage),
    when_time: asString(item.when_time),
    object: asString(item.object),
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

export async function extractDocument(file: File, parsedText: string): Promise<ExtractionPayload> {
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
  const normalizedInstructions = (Array.isArray(parsed.instructions) ? parsed.instructions : [])
    .map((item, index) => normalizeInstruction(item, index, parsedText))
    .filter((item): item is ExtractedInstruction => Boolean(item));
  const instructions = applyDeterministicContext(normalizedInstructions, parsedText);
  const unverified = instructions.filter((item) => !item.source_verified).length;

  return {
    document: {
      document_type: asString(documentValue.document_type) || "확인 필요",
      procedure_name: asString(documentValue.procedure_name) || "확인 필요",
      hospital_name: asString(documentValue.hospital_name),
      procedure_date: asString(documentValue.procedure_date),
      appointment_time: asString(documentValue.appointment_time),
      hospital_phone: asString(documentValue.hospital_phone),
    },
    instructions,
    mode: "information-extract",
    warnings: unverified ? [`원문 근거를 확인하지 못한 ${unverified}개 항목은 자동 적용하지 않았어요.`] : [],
  };
}

export function verifyExtractionSources(extraction: ExtractionPayload, pages: ParsedPage[]): ExtractionPayload {
  const parsedText = serializeParsedPages(pages);
  let unverified = 0;
  const correctedInstructions = applyDeterministicContext(extraction.instructions, parsedText);
  const instructions = correctedInstructions.map((instruction) => {
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
      // 모델의 페이지 번호보다 실제 Parse 블록에서 근거 문장이 발견된 페이지를 우선한다.
      source_page: sourceVerified
        ? bestPage.pageNumber
        : Math.min(pages.length, Math.max(1, instruction.source_page)),
      source_verified: sourceVerified,
      source_similarity: Number(similarity.toFixed(3)),
    };
  });
  return {
    ...extraction,
    instructions,
    warnings: [
      ...extraction.warnings.filter((warning) => !warning.includes("원문 근거")),
      ...(unverified ? [`원문 근거를 확인하지 못한 ${unverified}개 항목은 자동 적용하지 않았어요.`] : []),
    ],
  };
}

function classifyCondition(text: string): ConditionId {
  if (/위\s*(절제|수술)/.test(text)) return "GASTRECTOMY_HISTORY";
  if (/항혈|항응고|아스피린|와파린|피.*멎/.test(text)) return "BLOOD_THINNER_COUNT";
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

export function fallbackExtract(pages: ParsedPage[]): ExtractionPayload {
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
    const confirm = conditionId === "BLOOD_THINNER_COUNT" || /문의|확인|상의/.test(line);
    return {
      instruction_id: `F-${String(index + 1).padStart(3, "0")}`,
      source_page: pageNumber,
      source_text: line,
      applicability: confirm ? "confirm_with_hospital" : conditionId === "NO_CONDITION" ? "all" : "conditional",
      condition_id: conditionId,
      condition_value: conditionId === "NO_CONDITION" ? "" : "yes",
      action_id: actionId,
      when_stage: /전날/.test(line) ? "검사 전날" : /당일/.test(line) ? "검사 당일" : "",
      when_time: line.match(/(?:오전|오후|밤|저녁|아침)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/)?.[0] || "",
      object: "",
      importance: confirm ? "ask_hospital" : /금지|안\s*됩|반드시|필수/.test(line) ? "required" : "information",
      requires_user_question: conditionId !== "NO_CONDITION",
      source_verified: true,
      source_similarity: 1,
    };
  }).filter((item) => item.action_id !== "OTHER_ACTION" || item.condition_id !== "NO_CONDITION");

  const procedureName = /대장\s*내시경/.test(parsedText) ? "대장 내시경" : /위\s*내시경/.test(parsedText) ? "위 내시경" : "확인 필요";
  const phone = parsedText.match(/\d{2,4}-\d{3,4}-\d{4}/)?.[0] || "";
  return {
    document: {
      document_type: "검사 전 안내",
      procedure_name: procedureName,
      hospital_name: "",
      procedure_date: "",
      appointment_time: "",
      hospital_phone: phone,
    },
    instructions,
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
  const firstValue = (field: keyof ExtractionPayload["document"]) =>
    items.map((item) => item.document[field]).find(Boolean) || "";
  const instructions = parts.flatMap((part, fileIndex) =>
    part.extraction.instructions.map((instruction) => ({
      ...instruction,
      instruction_id: `D${fileIndex + 1}-${instruction.instruction_id}`,
      source_page: part.pageOffset
        + Math.min(part.pageCount, Math.max(1, instruction.source_page)),
    })),
  );
  const fallbackCount = items.filter((item) => item.mode === "fallback").length;
  return {
    document: {
      document_type: firstValue("document_type"),
      procedure_name: firstValue("procedure_name"),
      hospital_name: firstValue("hospital_name"),
      procedure_date: firstValue("procedure_date"),
      appointment_time: firstValue("appointment_time"),
      hospital_phone: firstValue("hospital_phone"),
    },
    instructions,
    mode: fallbackCount === 0 ? "information-extract" : fallbackCount === items.length ? "fallback" : "mixed",
    warnings: items.flatMap((item) => item.warnings),
  };
}
