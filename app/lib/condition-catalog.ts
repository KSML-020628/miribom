import type { ActionId, ConditionId, PersonalizationQuestion } from "./types";

interface QuestionTemplate extends Omit<PersonalizationQuestion, "source_text" | "reason_for_question"> {
  allowedActions: ActionId[];
  reason: string;
}

export const QUESTION_CATALOG: Partial<Record<ConditionId, QuestionTemplate>> = {
  GASTRECTOMY_HISTORY: {
    question_id: "gastrectomy_history",
    question: "위 수술을 받은 적 있어요?",
    helper_text: "위를 잘라내는 수술을 말해요.",
    image_tag: "GASTRECTOMY_HISTORY",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["EAT_PORRIDGE", "NO_FOOD", "NO_WATER", "OTHER_ACTION"],
    reason: "위 수술 경험에 따라 식사와 준비 방법이 달라집니다.",
  },
  BLOOD_THINNER_COUNT: {
    question_id: "blood_thinner_count",
    question: "피가 잘 멎지 않게 하는 약을 몇 가지 드세요?",
    helper_text: "아스피린 같은 약이에요. 약 봉투를 봐도 돼요.",
    image_tag: "TAKE_MEDICINE",
    options: [
      { value: "none", label: "안 먹어요", symbol: "×" },
      { value: "one", label: "한 가지", symbol: "○" },
      { value: "two_or_more", label: "두 가지 이상", symbol: "□" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["ASK_PRESCRIBER", "TAKE_MEDICINE", "OTHER_ACTION"],
    reason: "약의 종류와 개수에 따라 병원 확인 안내가 달라집니다.",
  },
  BLOOD_PRESSURE_MEDICINE: {
    question_id: "blood_pressure_medicine",
    question: "매일 드시는 혈압약이 있어요?",
    helper_text: "혈압을 낮추려고 먹는 약을 말해요.",
    image_tag: "TAKE_MEDICINE",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["TAKE_MEDICINE", "ASK_PRESCRIBER"],
    reason: "검사하는 날 약 안내가 달라질 수 있습니다.",
  },
  DIABETES_MEDICINE: {
    question_id: "diabetes_medicine",
    question: "당뇨약이나 인슐린을 쓰세요?",
    helper_text: "혈당을 낮추는 약이나 주사를 말해요.",
    image_tag: "TAKE_MEDICINE",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["TAKE_MEDICINE", "ASK_PRESCRIBER"],
    reason: "검사 전 음식과 약 준비가 달라질 수 있습니다.",
  },
  SEDATION: {
    question_id: "sedation",
    question: "잠든 상태로 검사받으세요?",
    helper_text: "수면 내시경을 말해요.",
    image_tag: "NO_DRIVING",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["NO_DRIVING", "COME_WITH_GUARDIAN", "OTHER_ACTION"],
    reason: "보호자와 이동 준비가 달라질 수 있습니다.",
  },
  GUARDIAN_AVAILABLE: {
    question_id: "guardian_available",
    question: "보호자와 함께 올 수 있어요?",
    helper_text: "검사 뒤에 함께 집에 갈 어른을 말해요.",
    image_tag: "COME_WITH_GUARDIAN",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["COME_WITH_GUARDIAN"],
    reason: "보호자 동행 가능 여부를 병원에 확인해야 할 수 있습니다.",
  },
  APPOINTMENT_PERIOD: {
    question_id: "appointment_period",
    question: "검사는 언제 받으세요?",
    helper_text: "예약 문자나 안내문을 확인해 주세요.",
    image_tag: "CHECK_TIME",
    options: [
      { value: "morning", label: "오전", symbol: "◷" },
      { value: "afternoon", label: "오후", symbol: "◷" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["TAKE_BOWEL_PREP", "NO_FOOD", "NO_WATER", "CHECK_TIME"],
    reason: "예약 시간에 따라 준비 시간이 달라집니다.",
  },
  BOWEL_PREP_READY: {
    question_id: "bowel_prep_ready",
    question: "장을 비우는 약을 준비했어요?",
    helper_text: "병원에서 알려준 장 청소약을 말해요.",
    image_tag: "TAKE_BOWEL_PREP",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["TAKE_BOWEL_PREP", "ASK_PRESCRIBER"],
    reason: "약 준비 여부에 따라 지금 확인할 일이 달라집니다.",
  },
  DENTAL_RISK: {
    question_id: "dental_risk",
    question: "흔들리는 이나 틀니가 있어요?",
    helper_text: "빠질 수 있는 치아가 있는지 확인해 주세요.",
    image_tag: "CHECK_TEETH",
    options: [
      { value: "yes", label: "네", symbol: "○" },
      { value: "no", label: "아니요", symbol: "×" },
      { value: "unknown", label: "잘 모르겠어요", symbol: "?" },
    ],
    required: true,
    allowedActions: ["CHECK_TEETH", "ASK_PRESCRIBER"],
    reason: "검사 전 치과 확인이 필요할 수 있습니다.",
  },
};

export const ACTION_IMAGE_TAGS: Record<ActionId, string> = {
  NO_FOOD: "STOP_EATING",
  NO_WATER: "NO_WATER",
  EAT_PORRIDGE: "EAT_PORRIDGE",
  TAKE_MEDICINE: "TAKE_MEDICINE",
  ASK_PRESCRIBER: "ASK_DOCTOR",
  TAKE_BOWEL_PREP: "TAKE_BOWEL_PREP",
  NO_DRIVING: "NO_DRIVING",
  COME_WITH_GUARDIAN: "COME_WITH_GUARDIAN",
  HOSPITAL_ARRIVAL: "HOSPITAL_ARRIVAL",
  CHECK_TEETH: "CHECK_TEETH",
  CHECK_TIME: "CHECK_TIME",
  OTHER_ACTION: "IMAGE_NOT_FOUND",
};

export const ACTION_SORT_ORDER: Record<ActionId, number> = {
  CHECK_TIME: 5,
  ASK_PRESCRIBER: 10,
  EAT_PORRIDGE: 20,
  TAKE_BOWEL_PREP: 30,
  NO_FOOD: 40,
  NO_WATER: 50,
  TAKE_MEDICINE: 60,
  HOSPITAL_ARRIVAL: 70,
  COME_WITH_GUARDIAN: 80,
  NO_DRIVING: 90,
  CHECK_TEETH: 95,
  OTHER_ACTION: 100,
};
