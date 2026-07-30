import assert from "node:assert/strict";
import {
  buildProcedureGroups,
  combinedProcedureName,
  detectInstructionConflicts,
  mergeDuplicateInstructions,
} from "../app/lib/document-merge.ts";

function document(overrides) {
  return {
    document_id: "DOC-001",
    source_file_name: "안내문.jpg",
    source_file_index: 0,
    document_type: "검사 전 안내",
    procedure_id: "COLONOSCOPY",
    procedure_name: "대장 내시경",
    document_role: "GENERAL_PREPARATION",
    hospital_name: "",
    procedure_date: "",
    appointment_time: "",
    appointment_period: "unknown",
    hospital_phone: "",
    regimen_name: "",
    page_count: 1,
    source_reliability: "clear",
    ...overrides,
  };
}

function instruction(overrides) {
  return {
    instruction_id: "I-001",
    document_id: "DOC-001",
    procedure_id: "COLONOSCOPY",
    document_role: "GENERAL_PREPARATION",
    source_file_name: "안내문.jpg",
    source_page: 1,
    source_text: "예약 시간에 맞는 안내문에 따라 장정결제를 복용하세요.",
    source_document_ids: ["DOC-001"],
    applicability: "all",
    condition_id: "NO_CONDITION",
    condition_value: "",
    action_id: "TAKE_BOWEL_PREP",
    when_stage: "검사 전날",
    when_time: "",
    object: "장정결제",
    method: "",
    amount: "",
    duration: "",
    importance: "required",
    requires_user_question: false,
    source_verified: true,
    source_similarity: 1,
    ...overrides,
  };
}

// A. 일반 안내와 오라팡 일정은 같은 대장내시경 그룹이지만 문서는 둘 다 보존한다.
const colonDocuments = [
  document({ document_id: "DOC-001" }),
  document({
    document_id: "DOC-002",
    source_file_name: "대장청결약.jpg",
    source_file_index: 1,
    document_role: "BOWEL_PREP_REGIMEN",
    appointment_period: "afternoon",
    regimen_name: "오라팡정",
  }),
];
const colonGroups = buildProcedureGroups(colonDocuments);
assert.equal(colonGroups.length, 1);
assert.deepEqual(colonGroups[0].document_ids, ["DOC-001", "DOC-002"]);
assert.deepEqual(
  new Set(colonGroups[0].document_roles),
  new Set(["GENERAL_PREPARATION", "BOWEL_PREP_REGIMEN"]),
);
assert.equal(colonGroups[0].appointment_period, "afternoon");
assert.equal(colonGroups[0].regimen_name, "오라팡정");

const general = instruction({});
const specific = instruction({
  instruction_id: "I-002",
  document_id: "DOC-002",
  document_role: "BOWEL_PREP_REGIMEN",
  source_file_name: "대장청결약.jpg",
  source_text: "오후 9시에 오라팡 14정을 1~2정씩 30분 동안 복용합니다.",
  source_document_ids: ["DOC-002"],
  when_time: "오후 9시",
  object: "오라팡정",
  amount: "14정",
  method: "1~2정씩 나누어 복용",
  duration: "30분",
});
const prioritized = mergeDuplicateInstructions([general, specific]);
assert.equal(prioritized.find((item) => item.instruction_id === "I-001")?.superseded_by, "I-002");
assert.equal(prioritized.find((item) => item.instruction_id === "I-002")?.amount, "14정");
const generalSibling = instruction({
  instruction_id: "I-001-B",
  action_id: "OTHER_ACTION",
  object: "관장",
});
const prioritizedWithSibling = mergeDuplicateInstructions([general, generalSibling, specific]);
assert.equal(
  prioritizedWithSibling.find((item) => item.instruction_id === "I-001-B")?.superseded_by,
  "I-002",
);

// B. 위내시경과 대장내시경은 두 검사로 보존하고 제목만 함께 표현한다.
const mixedGroups = buildProcedureGroups([
  document({
    document_id: "DOC-G",
    procedure_id: "GASTROSCOPY",
    procedure_name: "위 내시경",
  }),
  document({ document_id: "DOC-C" }),
]);
assert.equal(mixedGroups.length, 2);
assert.equal(combinedProcedureName(mixedGroups), "위·대장 내시경");

// C. 같은 시점의 서로 다른 복용량은 자동 선택하지 않고 충돌로 보낸다.
const conflicts = detectInstructionConflicts(colonDocuments, [
  specific,
  instruction({
    instruction_id: "I-003",
    document_id: "DOC-001",
    source_document_ids: ["DOC-001"],
    when_time: "오후 9시",
    object: "오라팡정",
    amount: "10정",
  }),
]);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].resolution, "confirm_with_hospital");

// D. 동일 지시는 한 번만 남기고 두 문서 출처를 모두 보존한다.
const duplicate = instruction({
  instruction_id: "I-004",
  document_id: "DOC-002",
  source_document_ids: ["DOC-002"],
});
const deduplicated = mergeDuplicateInstructions([general, duplicate]);
assert.equal(deduplicated.length, 1);
assert.deepEqual(new Set(deduplicated[0].source_document_ids), new Set(["DOC-001", "DOC-002"]));

console.log("document merge fixtures: 4 passed");
