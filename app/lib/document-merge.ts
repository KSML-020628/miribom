import type {
  AppointmentPeriod,
  DocumentRole,
  ExtractedDocument,
  ExtractedInstruction,
  InstructionConflict,
  ProcedureGroup,
  ProcedureId,
} from "./types";

const PROCEDURE_NAMES: Record<ProcedureId, string> = {
  GASTROSCOPY: "위 내시경",
  COLONOSCOPY: "대장 내시경",
  BLOOD_TEST: "혈액 검사",
  OTHER_PROCEDURE: "기타 검사",
  UNKNOWN_PROCEDURE: "확인 필요",
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compact(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function resolvedPeriod(documents: ExtractedDocument[]): AppointmentPeriod {
  const periods = unique(
    documents.map((document) => document.appointment_period).filter((period) => period !== "unknown"),
  );
  return periods.length === 1 ? periods[0] : "unknown";
}

export function procedureName(procedureId: ProcedureId, fallback = ""): string {
  if (procedureId === "OTHER_PROCEDURE" || procedureId === "UNKNOWN_PROCEDURE") {
    return fallback || PROCEDURE_NAMES[procedureId];
  }
  return PROCEDURE_NAMES[procedureId];
}

export function combinedProcedureName(groups: ProcedureGroup[]): string {
  const ids = unique(groups.map((group) => group.procedure_id));
  if (ids.length === 1) return groups[0]?.procedure_name || "검사";
  if (ids.length === 2 && ids.includes("GASTROSCOPY") && ids.includes("COLONOSCOPY")) {
    return "위·대장 내시경";
  }
  return "여러 검사";
}

export function buildProcedureGroups(documents: ExtractedDocument[]): ProcedureGroup[] {
  const groups = new Map<string, ExtractedDocument[]>();
  for (const document of documents) {
    // 분류하지 못한 문서끼리 임의로 같은 검사로 합치지 않는다.
    const key = document.procedure_id === "UNKNOWN_PROCEDURE"
      ? `${document.procedure_id}:${document.document_id}`
      : document.procedure_id;
    groups.set(key, [...(groups.get(key) || []), document]);
  }

  return [...groups.entries()].map(([key, items], index) => {
    const first = items[0];
    const regimenNames = unique(items.map((item) => item.regimen_name).filter(Boolean));
    return {
      group_id: `PROC-${String(index + 1).padStart(3, "0")}`,
      procedure_id: first.procedure_id,
      procedure_name: procedureName(first.procedure_id, first.procedure_name),
      document_ids: items.map((item) => item.document_id),
      document_roles: unique(items.map((item) => item.document_role)),
      appointment_period: resolvedPeriod(items),
      regimen_name: regimenNames.length === 1 ? regimenNames[0] : "",
    };
  });
}

function exactInstructionKey(instruction: ExtractedInstruction): string {
  return [
    instruction.procedure_id,
    instruction.action_id,
    instruction.condition_id,
    instruction.condition_value,
    compact(instruction.when_stage),
    compact(instruction.when_time),
    compact(instruction.object),
    compact(instruction.amount),
    compact(instruction.method),
  ].join("|");
}

function isSpecificRegimen(instruction: ExtractedInstruction): boolean {
  if (instruction.document_role !== "BOWEL_PREP_REGIMEN") return false;
  if (instruction.action_id === "EAT_PORRIDGE" || instruction.action_id === "NO_FOOD") return true;
  return instruction.action_id === "TAKE_BOWEL_PREP"
    && Boolean(instruction.when_time || instruction.amount || instruction.duration);
}

export function mergeDuplicateInstructions(
  source: ExtractedInstruction[],
): ExtractedInstruction[] {
  const merged = new Map<string, ExtractedInstruction>();
  for (const instruction of source) {
    const key = exactInstructionKey(instruction);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...instruction,
        source_document_ids: unique([
          ...(instruction.source_document_ids || []),
          instruction.document_id,
        ]),
      });
      continue;
    }
    merged.set(key, {
      ...existing,
      source_document_ids: unique([
        ...existing.source_document_ids,
        ...instruction.source_document_ids,
        instruction.document_id,
      ]),
      source_verified: existing.source_verified || instruction.source_verified,
      source_similarity: Math.max(existing.source_similarity, instruction.source_similarity),
    });
  }

  const instructions = [...merged.values()];
  const specificByProcedure = new Map<ProcedureId, ExtractedInstruction[]>();
  for (const instruction of instructions.filter(isSpecificRegimen)) {
    specificByProcedure.set(
      instruction.procedure_id,
      [...(specificByProcedure.get(instruction.procedure_id) || []), instruction],
    );
  }

  const explicitBloodPressure = instructions.find((instruction) => (
    instruction.condition_id === "BLOOD_PRESSURE_MEDICINE"
    && /복용|드세요|드십시오/.test(instruction.source_text)
    && Boolean(instruction.when_time)
  ));

  const prioritized = instructions.map((instruction) => {
    if (
      explicitBloodPressure
      && instruction.instruction_id !== explicitBloodPressure.instruction_id
      && instruction.condition_id === "BLOOD_PRESSURE_MEDICINE"
      && /제외|예외/.test(instruction.source_text)
    ) {
      return { ...instruction, superseded_by: explicitBloodPressure.instruction_id };
    }
    if (
      instruction.document_role === "BOWEL_PREP_REGIMEN"
      && instruction.action_id === "TAKE_BOWEL_PREP"
      && !instruction.when_time
    ) {
      const waterSummary = /물|생수/.test(instruction.object);
      const replacement = specificByProcedure.get(instruction.procedure_id)?.find((candidate) => (
        candidate.instruction_id !== instruction.instruction_id
        && Boolean(candidate.when_time)
        && /물|생수/.test(candidate.object) === waterSummary
      ));
      if (replacement) return { ...instruction, superseded_by: replacement.instruction_id };
    }
    if (
      instruction.document_role !== "GENERAL_PREPARATION"
      || !["TAKE_BOWEL_PREP", "EAT_PORRIDGE", "NO_FOOD"].includes(instruction.action_id)
    ) return instruction;
    const replacement = specificByProcedure.get(instruction.procedure_id)?.find((candidate) => (
      candidate.action_id === instruction.action_id
      && (
        instruction.action_id === "TAKE_BOWEL_PREP"
        || compact(candidate.when_stage) === compact(instruction.when_stage)
      )
    ));
    return replacement ? { ...instruction, superseded_by: replacement.instruction_id } : instruction;
  });
  const supersededSources = new Map<string, string>();
  for (const instruction of prioritized) {
    if (!instruction.superseded_by) continue;
    supersededSources.set(
      `${instruction.document_id}|${compact(instruction.source_text)}`,
      instruction.superseded_by,
    );
  }
  return prioritized.map((instruction) => {
    const replacement = supersededSources.get(
      `${instruction.document_id}|${compact(instruction.source_text)}`,
    );
    return replacement && !instruction.superseded_by
      ? { ...instruction, superseded_by: replacement }
      : instruction;
  });
}

function topicFor(instruction: ExtractedInstruction): string | null {
  if (instruction.action_id === "NO_WATER") return "water_intake";
  if (instruction.action_id === "NO_FOOD") return "fasting";
  if (instruction.action_id === "TAKE_BOWEL_PREP") return "bowel_prep";
  if (instruction.action_id === "TAKE_MEDICINE") return "medicine";
  if (instruction.action_id === "COME_WITH_GUARDIAN") return "guardian";
  if (instruction.action_id === "NO_DRIVING") return "driving";
  return null;
}

function conflictValue(instruction: ExtractedInstruction): string {
  return compact([
    instruction.condition_value,
    instruction.amount,
    instruction.duration,
  ].join(" "));
}

export function detectInstructionConflicts(
  documents: ExtractedDocument[],
  instructions: ExtractedInstruction[],
): InstructionConflict[] {
  const conflicts: InstructionConflict[] = [];

  const documentsByProcedure = new Map<ProcedureId, ExtractedDocument[]>();
  for (const document of documents) {
    documentsByProcedure.set(
      document.procedure_id,
      [...(documentsByProcedure.get(document.procedure_id) || []), document],
    );
  }
  for (const [procedureId, items] of documentsByProcedure) {
    const periods = unique(items.map((item) => item.appointment_period).filter((value) => value !== "unknown"));
    if (periods.length > 1) {
      conflicts.push({
        conflict_id: `CONFLICT-${String(conflicts.length + 1).padStart(3, "0")}`,
        procedure_id: procedureId,
        topic: "appointment_period",
        instruction_ids: [],
        document_ids: items.map((item) => item.document_id),
        summary: "안내문마다 검사 시간이 다르게 적혀 있어요. 병원에 확인해 주세요.",
        resolution: "confirm_with_hospital",
      });
    }
  }

  const buckets = new Map<string, ExtractedInstruction[]>();
  for (const instruction of instructions.filter((item) => !item.superseded_by)) {
    const topic = topicFor(instruction);
    if (!topic || !instruction.when_stage) continue;
    const key = [
      instruction.procedure_id,
      topic,
      compact(instruction.when_stage),
      compact(instruction.when_time),
    ].join("|");
    buckets.set(key, [...(buckets.get(key) || []), instruction]);
  }
  for (const items of buckets.values()) {
    const documentIds = unique(items.map((item) => item.document_id));
    const values = unique(items.map(conflictValue).filter(Boolean));
    if (documentIds.length < 2 || values.length < 2) continue;
    conflicts.push({
      conflict_id: `CONFLICT-${String(conflicts.length + 1).padStart(3, "0")}`,
      procedure_id: items[0].procedure_id,
      topic: topicFor(items[0]) || "instruction",
      instruction_ids: items.map((item) => item.instruction_id),
      document_ids: documentIds,
      summary: "두 안내문의 준비 내용이 서로 달라요. 어떤 안내를 따라야 하는지 병원에 확인해 주세요.",
      resolution: "confirm_with_hospital",
    });
  }
  return conflicts;
}

export function roleLabel(role: DocumentRole): string {
  const labels: Record<DocumentRole, string> = {
    GENERAL_PREPARATION: "일반 준비 안내",
    BOWEL_PREP_REGIMEN: "장 청소약 복용 안내",
    MEDICATION_GUIDE: "약 복용 안내",
    SCHEDULE_GUIDE: "검사 시간 안내",
    OTHER_GUIDE: "추가 안내",
    UNKNOWN_ROLE: "안내문",
  };
  return labels[role];
}
