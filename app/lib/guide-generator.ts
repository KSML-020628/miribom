import { ACTION_IMAGE_TAGS, ACTION_SORT_ORDER } from "./condition-catalog";
import { stageOrder } from "./stage-order";
import { simplifySelectedInstructions } from "./upstage";
import type {
  DocumentSummary,
  ExtractedInstruction,
  FinalGuideResult,
  GuidePage,
  InstructionConflict,
  PersonalizationQuestion,
  ProcedureGroup,
} from "./types";

function questionForCondition(instruction: ExtractedInstruction, questions: PersonalizationQuestion[]): PersonalizationQuestion | undefined {
  return questions.find((question) => question.linked_instruction_ids.includes(instruction.instruction_id))
    || questions.find((question) => (
      question.condition_id === instruction.condition_id
      && (
        question.scope === "per_patient"
        || question.scope_target_id === instruction.procedure_id
        || question.scope_target_id === instruction.document_id
      )
    ));
}

function activatingValues(
  instruction: ExtractedInstruction,
  question: PersonalizationQuestion,
): string[] {
  const optionValues = question.options.map((option) => option.value);
  const specified = instruction.condition_value;

  // 원문에 "아니요일 때", "오전일 때"처럼 분기가 명시되면 그 값만 켠다.
  if (specified && optionValues.includes(specified)) return [specified];

  // 값이 비어 있을 때는 부정·모름을 제외한 선택에만 조건 안내를 켠다.
  const nonActivating = new Set(["no", "none", "unknown"]);
  const positiveValues = optionValues.filter((value) => !nonActivating.has(value));
  return positiveValues.length ? positiveValues : optionValues.filter((value) => value !== "unknown");
}

function whenLabel(instruction: ExtractedInstruction): string {
  return [instruction.when_stage, instruction.when_time].filter(Boolean).join(" ");
}

function fixedTemplate(instruction: ExtractedInstruction): { title: string; body: string[] } | null {
  switch (instruction.action_id) {
    case "NO_FOOD":
      return instruction.object.length > 18
        ? { title: "이 음식은 먹지 마세요", body: [instruction.object] }
        : { title: "음식을 먹지 마세요", body: [] };
    case "NO_WATER":
      return { title: "물을 마시지 마세요", body: [] };
    case "EAT_PORRIDGE":
      return instruction.object.length > 18
        ? { title: "이 음식은 드셔도 돼요", body: [instruction.object] }
        : { title: "죽을 드세요", body: ["반찬 없이 흰죽만 드세요."] };
    case "NO_DRIVING":
      return { title: "직접 운전하지 마세요", body: ["검사한 날에는 직접 운전하지 마세요."] };
    case "COME_WITH_GUARDIAN":
      return { title: "보호자와 함께 오세요", body: ["어른 보호자와 함께 병원에 오세요."] };
    case "HOSPITAL_ARRIVAL":
      return { title: "병원에 오세요", body: [] };
    case "CHECK_TEETH":
      return { title: "이를 확인해 주세요", body: ["흔들리는 이나 틀니가 있으면 병원에 말해 주세요."] };
    case "CHECK_TIME":
      return { title: "예약 시간을 확인하세요", body: [] };
    case "ASK_PRESCRIBER":
      return { title: "약을 혼자 바꾸지 마세요", body: ["약을 처방한 의료진에게 먼저 물어보세요."] };
    case "TAKE_MEDICINE":
      if (instruction.condition_id === "BLOOD_PRESSURE_MEDICINE") {
        return { title: "혈압약만 드세요", body: ["물은 조금만 함께 드세요."] };
      }
      if (instruction.condition_id === "BLOOD_THINNER_COUNT") {
        return { title: "약을 혼자 끊지 마세요", body: ["약 이름을 병원에 알려 주세요."] };
      }
      if (instruction.condition_id === "BLOOD_THINNER_USE") {
        return { title: "먹는 약을 병원에 알려 주세요", body: ["혼자 약을 끊지 마세요."] };
      }
      return { title: "먹는 약을 확인하세요", body: ["언제 먹는지는 병원에 물어보세요."] };
    case "TAKE_BOWEL_PREP": {
      const isWater = /물|생수/.test(instruction.object)
        && /mL|ml|cc|L|ℓ|리터|컵/.test(instruction.amount);
      const normalizedObject = instruction.object.normalize("NFKC").replace(/\s+/g, "");
      const normalizedAmount = instruction.amount.normalize("NFKC").replace(/\s+/g, "");
      const amount = normalizedAmount && normalizedObject.includes(normalizedAmount)
        ? ""
        : instruction.amount;
      const subject = isWater
        ? `물${amount ? ` ${amount}` : ""}`
        : [instruction.object || "장을 비우는 약", amount].filter(Boolean).join(" ");
      // "복용법"·"복용량"처럼 뒤에 다른 말이 붙는 복합 명사는 그대로 두고,
      // "복용합니다/복용하세요"처럼 동사로 끝나는 경우만 쉬운 말로 바꾼다.
      const easyMethod = instruction.method
        .replace(/복용\s*(?:합니다|하세요|해요)/g, "드세요")
        .replace(/마십니다/g, "마시세요");
      const methodRepeatsDuration = Boolean(instruction.duration)
        && /^(?:천천히\s*)?(?:마시세요|드세요)\.?$/.test(easyMethod.trim());
      return {
        title: isWater ? `${subject} 마시세요` : `${subject} 드세요`,
        body: [
          methodRepeatsDuration ? "" : easyMethod,
          instruction.duration
            ? `${instruction.duration} 동안 천천히 ${isWater ? "마시세요" : "드세요"}.`
            : "",
        ].filter(Boolean),
      };
    }
    default:
      return null;
  }
}

function compactBody(title: string, lines: string[]): string[] {
  const normalize = (text: string) => text.normalize("NFKC").replace(/[\s.。!?！？]/g, "");
  const normalizedTitle = normalize(title);
  const seen = new Set<string>();

  return lines.filter((line) => {
    const normalizedLine = normalize(line);
    if (!normalizedLine || normalizedLine === normalizedTitle || seen.has(normalizedLine)) return false;
    seen.add(normalizedLine);
    return true;
  }).slice(0, 2);
}

function personalizationNote(instruction: ExtractedInstruction): string {
  switch (instruction.condition_id) {
    case "BLOOD_PRESSURE_MEDICINE":
      return "혈압약을 드신다고 답했어요.";
    case "BLOOD_THINNER_COUNT":
      return "먹는 약의 개수를 반영했어요.";
    case "BLOOD_THINNER_USE":
      return "피가 잘 멎지 않게 하는 약 답변을 반영했어요.";
    case "GASTRECTOMY_HISTORY":
      return "위 수술 경험을 반영했어요.";
    case "SEDATION":
      return "수면 검사 선택을 반영했어요.";
    case "DENTAL_RISK":
      return "치아 상태 답변을 반영했어요.";
    default:
      return "내 답변에 맞춘 안내예요.";
  }
}

function sectionFor(instruction: ExtractedInstruction): string {
  if (instruction.when_stage) return instruction.when_stage;
  if (instruction.importance === "ask_hospital" || instruction.action_id === "ASK_PRESCRIBER") return "병원에 물어볼 내용";
  return "지금 확인할 일";
}

export async function buildFinalGuide(
  document: DocumentSummary,
  questions: PersonalizationQuestion[],
  instructions: ExtractedInstruction[],
  answers: Record<string, string>,
  procedures: ProcedureGroup[] = [],
  conflicts: InstructionConflict[] = [],
): Promise<FinalGuideResult> {
  // 답으로 미리 삭제하지 않는다. 원문 근거가 확인된 모든 분기를 만들어 두고,
  // activation과 현재 답변으로 화면·PDF에서 즉시 표시 여부를 바꾼다.
  const included = instructions.filter((instruction) => {
    if (!instruction.source_verified || instruction.superseded_by) return false;
    if (
      instruction.action_id === "CHECK_TIME"
      && procedures.some((procedure) => (
        procedure.procedure_id === instruction.procedure_id
        && procedure.appointment_period !== "unknown"
      ))
    ) return false;
    return true;
  });

  const timeOrder = (instruction: ExtractedInstruction) => {
    const match = instruction.when_time.match(/(오전|오후|아침|저녁|밤)?\s*(\d{1,2})(?::|\s*시\s*)?(\d{1,2})?/);
    if (!match) return 9999;
    let hour = Number(match[2]);
    if ((match[1] === "오후" || match[1] === "저녁" || match[1] === "밤") && hour < 12) hour += 12;
    return hour * 60 + Number(match[3] || 0);
  };
  const ordered = included.sort((left, right) =>
    stageOrder(left.when_stage) - stageOrder(right.when_stage) ||
    timeOrder(left) - timeOrder(right) ||
    ACTION_SORT_ORDER[left.action_id] - ACTION_SORT_ORDER[right.action_id],
  );
  const needsSolar = ordered.filter((instruction) => !fixedTemplate(instruction));
  let solarText: Record<string, string> = {};
  if (needsSolar.length) {
    try {
      solarText = await simplifySelectedInstructions(needsSolar);
    } catch (error) {
      console.error("Easy text fallback used:", error);
    }
  }

  const cover: GuidePage = {
    page_number: 1,
    section: "표지",
    when: document.procedure_date,
    title: `나를 위한 ${document.procedure_name} 준비 안내`,
    body: [
      document.hospital_name ? `${document.hospital_name} 안내문을 바탕으로 만들었어요.` : "병원 안내문을 바탕으로 만들었어요.",
      [document.procedure_date, document.appointment_time].filter(Boolean).join(" "),
    ].filter(Boolean),
    image_tag: document.procedure_name.includes("대장") && !document.procedure_name.includes("위·")
      ? "COLONOSCOPY"
      : document.procedure_name.includes("위") ? "GASTROSCOPY" : "IMAGE_NOT_FOUND",
    importance: "information",
    personalized: false,
  };

  const pages = ordered.map((instruction, index): GuidePage => {
    const template = fixedTemplate(instruction);
    const question = questionForCondition(instruction, questions);
    const resolvedAppointment = instruction.condition_id === "APPOINTMENT_PERIOD"
      ? procedures.find((procedure) => procedure.procedure_id === instruction.procedure_id)?.appointment_period
      : undefined;
    const easy = solarText[instruction.instruction_id];
    const title = template?.title || easy || "안내문을 확인해 주세요";
    const body = compactBody(
      title,
      template?.body || (easy ? [] : ["정확한 내용은 병원에 확인해 주세요."]),
    );
    const isConditional = instruction.applicability !== "all"
      && instruction.condition_id !== "NO_CONDITION";
    const activation = isConditional && question
      ? {
          question_id: question.question_id,
          values: activatingValues(instruction, question),
        }
      : undefined;
    return {
      page_number: index + 2,
      section: sectionFor(instruction),
      when: whenLabel(instruction),
      title,
      body,
      image_tag: ACTION_IMAGE_TAGS[instruction.action_id],
      importance: instruction.importance,
      personalized: Boolean(activation),
      personalized_by: question
        ? [question.question_id]
        : resolvedAppointment && resolvedAppointment !== "unknown"
          ? [`appointment_period:${instruction.procedure_id}`]
          : [],
      personalization_note: question
        ? personalizationNote(instruction)
        : resolvedAppointment === "afternoon"
          ? "오후 검사 시간을 반영했어요."
          : resolvedAppointment === "morning"
            ? "오전 검사 시간을 반영했어요."
            : "",
      procedure_id: instruction.procedure_id,
      source_document_ids: instruction.source_document_ids,
      source_instruction_ids: [instruction.instruction_id],
      activation,
    };
  });

  const summary = questions.map((question) => {
    const answer = answers[question.question_id] || "unknown";
    const option = question.options.find((item) => item.value === answer);
    return { label: question.question.replace(/[?？]/g, ""), value: option?.label || "잘 모르겠어요" };
  });

  return {
    mode: "final_guide",
    project: {
      title: cover.title,
      procedure_name: document.procedure_name,
      hospital_name: document.hospital_name,
      procedure_date: document.procedure_date,
      appointment_time: document.appointment_time,
      created_at: new Date().toISOString().slice(0, 10),
    },
    user_profile_summary: summary,
    applied_answers: summary.map((item, index) => ({
      question_id: questions[index]?.question_id || "",
      answer: item.value,
      effect_on_instructions: "원문에서 이 답에 해당하는 안내만 선택했어요.",
    })),
    personalization_questions: questions,
    pages: [cover, ...pages].slice(0, 30),
    hospital_confirmation: [
      ...questions.map((question) => ({
        title: "잘 모르는 내용은 병원에 물어보세요",
        body: `${question.question.replace(/[?？]/g, "")} 내용을 병원에 확인해 주세요.`,
        image_tag: "ASK_DOCTOR",
        activation: {
          question_id: question.question_id,
          values: ["unknown"],
        },
      })),
      ...conflicts.map((conflict) => ({
        title: "안내문 내용이 서로 달라요",
        body: conflict.summary,
        image_tag: "ASK_DOCTOR",
      })),
    ],
    warnings: instructions.some((instruction) => !instruction.source_verified)
      ? ["원문 근거를 확인하지 못한 항목은 안내서에서 제외했어요."]
      : [],
    footer: "이 안내서는 병원에서 받은 안내문을 쉽게 정리한 자료예요. 실제 준비는 병원에서 받은 안내와 의료진의 설명을 따라 주세요.",
  };
}
