import { QUESTION_CATALOG } from "./condition-catalog";
import type { AnalysisResult, ExtractionPayload, PersonalizationQuestion } from "./types";

export function buildAnalysisFromExtraction(extraction: ExtractionPayload, pageCount: number): AnalysisResult {
  const questionMap = new Map<string, PersonalizationQuestion>();
  let rejectedConditionCount = 0;

  for (const instruction of extraction.instructions) {
    if (instruction.condition_id === "NO_CONDITION") continue;
    const template = QUESTION_CATALOG[instruction.condition_id];
    if (!template || !instruction.source_verified || !template.allowedActions.includes(instruction.action_id)) {
      rejectedConditionCount += 1;
      continue;
    }
    const procedure = extraction.procedures.find((item) => item.procedure_id === instruction.procedure_id);
    if (
      instruction.condition_id === "APPOINTMENT_PERIOD"
      && procedure
      && procedure.appointment_period !== "unknown"
    ) continue;
    const scopeTargetId = template.scope === "per_patient"
      ? "PATIENT"
      : template.scope === "per_procedure"
        ? instruction.procedure_id
        : instruction.document_id;
    const dedupKey = `${instruction.condition_id}:${template.scope}:${scopeTargetId}:${template.option_type}`;
    const existing = questionMap.get(dedupKey);
    const sourceText = existing?.source_text
      ? `${existing.source_text} / ${instruction.source_text}`.slice(0, 700)
      : instruction.source_text;
    const regimenName = procedure?.regimen_name;
    const questionId = template.scope === "per_patient"
      ? template.question_id
      : `${template.question_id}:${scopeTargetId}`;
    questionMap.set(dedupKey, {
      question_id: questionId,
      condition_id: instruction.condition_id,
      scope: template.scope,
      scope_target_id: scopeTargetId,
      option_type: template.option_type,
      linked_instruction_ids: [
        ...new Set([...(existing?.linked_instruction_ids || []), instruction.instruction_id]),
      ],
      question: instruction.condition_id === "BOWEL_PREP_READY" && regimenName
        ? `${regimenName.replace(/정$/, "")} 약을 준비했어요?`
        : template.question,
      helper_text: template.helper_text,
      image_tag: template.image_tag,
      options: template.options,
      source_text: sourceText,
      reason_for_question: template.reason,
      required: template.required,
    });
  }

  const unverifiedCount = extraction.instructions.filter((instruction) => !instruction.source_verified).length;
  const warnings = [...extraction.warnings];
  if (rejectedConditionCount) warnings.push(`근거 또는 행동 연결을 확인하지 못한 조건 ${rejectedConditionCount}개는 질문에서 제외했어요.`);
  if (unverifiedCount && !warnings.some((warning) => warning.includes("원문 근거"))) {
    warnings.push(`원문 근거를 확인하지 못한 ${unverifiedCount}개 항목은 자동 적용하지 않았어요.`);
  }

  return {
    mode: "questionnaire",
    document: {
      ...extraction.document,
      page_count: pageCount,
      source_reliability: extraction.mode === "information-extract" && !unverifiedCount ? "clear" : "partially_unclear",
    },
    documents: extraction.documents,
    procedures: extraction.procedures,
    conflicts: extraction.conflicts,
    preparation_items: extraction.instructions
      .filter((instruction) => instruction.source_verified)
      .map((instruction) => instruction.source_text)
      .slice(0, 12),
    personalization_questions: Array.from(questionMap.values()).slice(0, 12),
    instructions: extraction.instructions,
    extraction_mode: extraction.mode,
    warnings,
  };
}
