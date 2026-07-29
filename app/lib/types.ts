export type SourceReliability = "clear" | "partially_unclear" | "unclear";
export type AnswerValue = string;
export type Importance = "required" | "caution" | "ask_hospital" | "information";
export type Applicability = "all" | "conditional" | "confirm_with_hospital";

export const CONDITION_IDS = [
  "NO_CONDITION",
  "GASTRECTOMY_HISTORY",
  "BLOOD_THINNER_COUNT",
  "BLOOD_PRESSURE_MEDICINE",
  "DIABETES_MEDICINE",
  "SEDATION",
  "GUARDIAN_AVAILABLE",
  "APPOINTMENT_PERIOD",
  "BOWEL_PREP_READY",
  "DENTAL_RISK",
  "UNKNOWN_CONDITION",
] as const;

export type ConditionId = (typeof CONDITION_IDS)[number];

export const ACTION_IDS = [
  "NO_FOOD",
  "NO_WATER",
  "EAT_PORRIDGE",
  "TAKE_MEDICINE",
  "ASK_PRESCRIBER",
  "TAKE_BOWEL_PREP",
  "NO_DRIVING",
  "COME_WITH_GUARDIAN",
  "HOSPITAL_ARRIVAL",
  "CHECK_TEETH",
  "CHECK_TIME",
  "OTHER_ACTION",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export interface DocumentSummary {
  document_type: string;
  procedure_name: string;
  hospital_name: string;
  procedure_date: string;
  appointment_time: string;
  hospital_phone: string;
  page_count: number;
  source_reliability: SourceReliability;
}

export interface QuestionOption {
  value: AnswerValue;
  label: string;
  symbol: "○" | "×" | "?" | "◷" | "□";
}

export interface PersonalizationQuestion {
  question_id: string;
  question: string;
  helper_text: string;
  image_tag: string;
  options: QuestionOption[];
  source_text: string;
  reason_for_question: string;
  required: boolean;
}

export interface AnalysisResult {
  mode: "questionnaire";
  document: DocumentSummary;
  preparation_items: string[];
  personalization_questions: PersonalizationQuestion[];
  instructions: ExtractedInstruction[];
  extraction_mode: "information-extract" | "mixed" | "fallback";
  warnings: string[];
}

export interface ExtractedInstruction {
  instruction_id: string;
  source_page: number;
  source_text: string;
  applicability: Applicability;
  condition_id: ConditionId;
  condition_value: string;
  action_id: ActionId;
  when_stage: string;
  when_time: string;
  object: string;
  importance: Importance;
  requires_user_question: boolean;
  source_verified: boolean;
  source_similarity: number;
}

export interface ExtractionPayload {
  document: Omit<DocumentSummary, "page_count" | "source_reliability">;
  instructions: ExtractedInstruction[];
  mode: "information-extract" | "mixed" | "fallback";
  warnings: string[];
}

export interface AppliedAnswer {
  question_id: string;
  answer: AnswerValue;
  effect_on_instructions: string;
}

export interface GuidePage {
  page_number: number;
  section: string;
  when?: string;
  title: string;
  body: string[];
  image_tag: string;
  importance: Importance;
  personalized: boolean;
  personalized_by?: string[];
  personalization_note?: string;
}

export interface HospitalConfirmation {
  title: string;
  body: string;
  image_tag: string;
}

export interface FinalGuideResult {
  mode: "final_guide";
  project: {
    title: string;
    procedure_name: string;
    hospital_name: string;
    procedure_date: string;
    appointment_time: string;
    created_at: string;
  };
  user_profile_summary: Array<{ label: string; value: string }>;
  applied_answers: AppliedAnswer[];
  pages: GuidePage[];
  hospital_confirmation: HospitalConfirmation[];
  warnings: string[];
  footer: string;
}

export interface ParseResponse {
  content: string;
  pageCount: number;
  extraction: ExtractionPayload;
}

export interface ApiError {
  error: string;
}

export type ChatIntent =
  | "water"
  | "food"
  | "medicine"
  | "bowel_prep"
  | "fasting"
  | "time"
  | "driving"
  | "guardian"
  | "arrival"
  | "dental"
  | "general"
  | "unknown";

export type ChatReplyKind =
  | "grounded"
  | "clarification"
  | "ask_hospital"
  | "symptom"
  | "off_topic";

export interface ChatEvidence {
  source: "맞춤 안내서" | "병원 안내문";
  text: string;
}

export interface ChatReply {
  kind: ChatReplyKind;
  answer: string;
  intent: ChatIntent;
  understood_as?: string;
  evidence: ChatEvidence[];
  suggestions: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  intent?: ChatIntent;
}

export type AppStep = "upload" | "review" | "questions" | "guide";
export type ProcessingStage = "idle" | "parsing" | "analyzing" | "generating" | "done" | "error";

export const AVAILABLE_IMAGE_TAGS = [
  "COLONOSCOPY",
  "GASTROSCOPY",
  "GASTRECTOMY_HISTORY",
  "STOP_EATING",
  "NO_WATER",
  "EAT_PORRIDGE",
  "TAKE_MEDICINE",
  "ASK_DOCTOR",
  "TAKE_BOWEL_PREP",
  "NO_DRIVING",
  "COME_WITH_GUARDIAN",
  "HOSPITAL_ARRIVAL",
  "CALL_HOSPITAL",
  "CHECK_TEETH",
  "CHECK_TIME",
  "IMAGE_NOT_FOUND",
] as const;
