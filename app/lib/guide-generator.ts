import { ACTION_IMAGE_TAGS, ACTION_SORT_ORDER, QUESTION_CATALOG } from "./condition-catalog";
import { simplifySelectedInstructions } from "./upstage";
import type {
  DocumentSummary,
  ExtractedInstruction,
  FinalGuideResult,
  GuidePage,
  PersonalizationQuestion,
} from "./types";

const STAGE_ORDER: Record<string, number> = {
  "지금 확인": 5,
  "검사 3일 전": 10,
  "검사 전날": 20,
  "검사 당일": 30,
  "병원에 올 때": 40,
  "검사 후": 50,
};

function questionForCondition(instruction: ExtractedInstruction, questions: PersonalizationQuestion[]): PersonalizationQuestion | undefined {
  const template = QUESTION_CATALOG[instruction.condition_id];
  return template ? questions.find((question) => question.question_id === template.question_id) : undefined;
}

function answerApplies(instruction: ExtractedInstruction, answer: string | undefined): "include" | "exclude" | "confirm" {
  if (!instruction.source_verified) return "exclude";
  if (instruction.applicability === "all" || instruction.condition_id === "NO_CONDITION") return "include";
  if (!answer || answer === "unknown") return "confirm";
  if (instruction.condition_id === "BLOOD_THINNER_COUNT") {
    if (answer === "none") return "exclude";
    const expected = instruction.condition_value;
    if (!expected || answer !== expected) return "exclude";
    return instruction.applicability === "confirm_with_hospital" ? "confirm" : "include";
  }
  if (instruction.condition_id === "GUARDIAN_AVAILABLE" && answer === "no") return "confirm";
  const expected = instruction.condition_value || "yes";
  return answer === expected ? (instruction.applicability === "confirm_with_hospital" ? "confirm" : "include") : "exclude";
}

function whenLabel(instruction: ExtractedInstruction): string {
  return [instruction.when_stage, instruction.when_time].filter(Boolean).join(" ");
}

function fixedTemplate(instruction: ExtractedInstruction): { title: string; body: string[] } | null {
  switch (instruction.action_id) {
    case "NO_FOOD":
      return { title: "음식을 먹지 마세요", body: [] };
    case "NO_WATER":
      return { title: "물을 마시지 마세요", body: [] };
    case "EAT_PORRIDGE":
      return { title: "죽을 드세요", body: ["반찬 없이 흰죽만 드세요."] };
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
      return { title: "먹는 약을 확인하세요", body: ["언제 먹는지는 병원에 물어보세요."] };
    case "TAKE_BOWEL_PREP":
      return { title: "장을 비우는 약을 드세요", body: ["안내문에 적힌 양만 드세요."] };
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
): Promise<FinalGuideResult> {
  const selected: ExtractedInstruction[] = [];
  const confirmations: ExtractedInstruction[] = [];
  for (const instruction of instructions) {
    const question = questionForCondition(instruction, questions);
    const decision = answerApplies(instruction, question ? answers[question.question_id] : undefined);
    if (decision === "include") selected.push(instruction);
    if (decision === "confirm") confirmations.push(instruction);
  }

  const ordered = selected.sort((left, right) =>
    (STAGE_ORDER[left.when_stage] ?? 99) - (STAGE_ORDER[right.when_stage] ?? 99) ||
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
    image_tag: document.procedure_name.includes("대장") ? "COLONOSCOPY" : "GASTROSCOPY",
    importance: "information",
    personalized: false,
  };

  const pages = ordered.map((instruction, index): GuidePage => {
    const template = fixedTemplate(instruction);
    const question = questionForCondition(instruction, questions);
    const easy = solarText[instruction.instruction_id];
    const title = template?.title || easy || "안내문을 확인해 주세요";
    const body = compactBody(
      title,
      template?.body || (easy ? [] : ["정확한 내용은 병원에 확인해 주세요."]),
    );
    return {
      page_number: index + 2,
      section: sectionFor(instruction),
      when: whenLabel(instruction),
      title,
      body,
      image_tag: ACTION_IMAGE_TAGS[instruction.action_id],
      importance: instruction.importance,
      personalized: instruction.applicability !== "all",
      personalized_by: question ? [question.question_id] : [],
      personalization_note: question ? personalizationNote(instruction) : "",
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
    pages: [cover, ...pages].slice(0, 18),
    hospital_confirmation: confirmations.map((instruction) => ({
      title: "병원에 확인해 주세요",
      body: instruction.source_text,
      image_tag: "ASK_DOCTOR",
    })),
    warnings: instructions.some((instruction) => !instruction.source_verified)
      ? ["원문 근거를 확인하지 못한 항목은 안내서에서 제외했어요."]
      : [],
    footer: "이 안내서는 병원에서 받은 안내문을 쉽게 정리한 자료예요. 실제 준비는 병원에서 받은 안내와 의료진의 설명을 따라 주세요.",
  };
}
