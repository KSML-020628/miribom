export type SourceReliability = "clear" | "partially_unclear" | "unclear";
export type AnswerValue = string;
export type Importance = "required" | "caution" | "ask_hospital" | "information";
export type Applicability = "all" | "conditional" | "confirm_with_hospital";
export type ProcedureId =
  | "GASTROSCOPY"
  | "COLONOSCOPY"
  | "BLOOD_TEST"
  | "OTHER_PROCEDURE"
  | "UNKNOWN_PROCEDURE";
export type DocumentRole =
  | "GENERAL_PREPARATION"
  | "BOWEL_PREP_REGIMEN"
  | "MEDICATION_GUIDE"
  | "SCHEDULE_GUIDE"
  | "OTHER_GUIDE"
  | "UNKNOWN_ROLE";
export type AppointmentPeriod = "morning" | "afternoon" | "unknown";
export type QuestionScope = "per_patient" | "per_procedure" | "per_document";
export type SupportedDocumentType =
  | "PRE_EXAM_GUIDE"
  | "PRE_PROCEDURE_GUIDE"
  | "PRE_SURGERY_GUIDE"
  | "ADMISSION_GUIDE"
  | "DISCHARGE_GUIDE"
  | "MEDICATION_PREPARATION_GUIDE";
export type DocumentValidationStatus =
  | "VALID"
  | "UNSUPPORTED_DOCUMENT"
  | "UNREADABLE_DOCUMENT"
  | "LOW_CONFIDENCE";

export const CONDITION_IDS = [
  "NO_CONDITION",
  "GASTRECTOMY_HISTORY",
  "BLOOD_THINNER_USE",
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
  procedure_id?: ProcedureId;
  procedure_name: string;
  hospital_name: string;
  procedure_date: string;
  appointment_time: string;
  hospital_phone: string;
  page_count: number;
  document_count?: number;
  source_reliability: SourceReliability;
}

export interface ExtractedDocument {
  document_id: string;
  source_file_name: string;
  source_file_index: number;
  document_type: string;
  procedure_id: ProcedureId;
  procedure_name: string;
  document_role: DocumentRole;
  hospital_name: string;
  procedure_date: string;
  appointment_time: string;
  appointment_period: AppointmentPeriod;
  hospital_phone: string;
  regimen_name: string;
  page_count: number | null;
  source_reliability: SourceReliability;
}

export interface ProcedureGroup {
  group_id: string;
  procedure_id: ProcedureId;
  procedure_name: string;
  document_ids: string[];
  document_roles: DocumentRole[];
  appointment_period: AppointmentPeriod;
  regimen_name: string;
}

export interface InstructionConflict {
  conflict_id: string;
  procedure_id: ProcedureId;
  topic: string;
  instruction_ids: string[];
  document_ids: string[];
  summary: string;
  resolution: "confirm_with_hospital";
}

export interface QuestionOption {
  value: AnswerValue;
  label: string;
  symbol: "○" | "×" | "?" | "◷" | "□";
}

export interface PersonalizationQuestion {
  question_id: string;
  condition_id: ConditionId;
  scope: QuestionScope;
  scope_target_id: string;
  option_type: string;
  linked_instruction_ids: string[];
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
  documents: ExtractedDocument[];
  procedures: ProcedureGroup[];
  conflicts: InstructionConflict[];
  preparation_items: string[];
  personalization_questions: PersonalizationQuestion[];
  instructions: ExtractedInstruction[];
  extraction_mode: "information-extract" | "mixed" | "fallback";
  warnings: string[];
}

export interface ExtractedInstruction {
  instruction_id: string;
  document_id: string;
  procedure_id: ProcedureId;
  document_role: DocumentRole;
  source_file_name: string;
  source_page: number;
  source_text: string;
  source_document_ids: string[];
  superseded_by?: string;
  applicability: Applicability;
  condition_id: ConditionId;
  condition_value: string;
  action_id: ActionId;
  when_stage: string;
  when_time: string;
  object: string;
  method: string;
  amount: string;
  duration: string;
  importance: Importance;
  requires_user_question: boolean;
  source_verified: boolean;
  source_similarity: number;
}

export interface ExtractionPayload {
  document: Omit<DocumentSummary, "page_count" | "source_reliability">;
  documents: ExtractedDocument[];
  procedures: ProcedureGroup[];
  instructions: ExtractedInstruction[];
  conflicts: InstructionConflict[];
  mode: "information-extract" | "mixed" | "fallback";
  warnings: string[];
}

export interface ParsedCoordinate {
  x: number;
  y: number;
}

export interface ParsedBlock {
  blockId: string;
  category: string;
  text: string;
  markdown: string;
  coordinates?: ParsedCoordinate[];
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
  markdown: string;
  blocks: ParsedBlock[];
  documentId?: string;
  sourceFileName?: string;
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
  procedure_id?: ProcedureId;
  source_document_ids?: string[];
  source_instruction_ids?: string[];
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
  documentId: string;
  pages: ParsedPage[];
  pageCount: number;
  extraction: ExtractionPayload;
}

export interface ApiError {
  error: string;
  validationStatus?: DocumentValidationStatus;
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

export type ChatEvidenceStatus =
  | "FOUND_IN_APPLIED_GUIDE"
  | "FOUND_IN_DOCUMENT"
  | "NOT_FOUND"
  | "MEDICAL_CONFIRMATION_REQUIRED";

export interface ChatEvidence {
  source: "맞춤 안내서" | "병원 안내문";
  text: string;
  pageNumber?: number;
  sourceInstructionIds?: string[];
  sourceDocumentIds?: string[];
}

export interface ChatReply {
  kind: ChatReplyKind;
  answer: string;
  intent: ChatIntent;
  understood_as?: string;
  evidence: ChatEvidence[];
  evidenceStatus: ChatEvidenceStatus;
  sourceInstructionIds: string[];
  sourceDocumentIds: string[];
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
