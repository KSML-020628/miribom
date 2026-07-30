# 고령층 친화 안내서 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미리봄의 흐름을 "업로드 → 쉬운 안내서" 2단계로 줄이고, 맞춤 질문을 안내서 안으로 옮겨 네/아니오로 안내문을 즉시 보이거나 숨기게 한다.

**Architecture:** 서버는 해당 가능한 모든 안내문 페이지를 한 번에 생성하고 각 페이지에 "어느 질문의 어느 답에서 켜지는지"(`activation`)를 태그한다. 화면은 사용자의 답(`answers`)을 상태로 들고 `activation`으로 페이지를 실시간 필터링한다. 서버 재호출 없이 즉시 반응한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9. 테스트 러너 없음 → 검증은 `npx tsc --noEmit`, `npm run build`, 개발서버 수동 확인.

## Global Constraints

- 모든 UI 문구는 한글. 외국어·약어 지양 (표준 4).
- 용어 고정 (표준 4): "쉬운 안내서", "나에게 맞추기", "고치기", "병원에 전화하기", "잘 모르겠어요".
- 화면 텍스트 최소 크기 16px(=1rem) 이상 (표준 1).
- 폰트는 기존 Pretendard/Noto Sans KR 유지 (필기체 금지, 표준 1).
- 컨트롤 1개 = 기능 1개 (표준 5). 기능 없는 요소는 버튼 모양 금지 (표준 6).
- 되돌리기 가능: 답 변경은 항상 즉시 반영되고 원복 가능 (표준 9).
- 접근성 설정 저장 키: `localStorage["miribom.fontSize"]`, `localStorage["miribom.contrast"]`.
- 각 작업은 끝에 반드시 `npx tsc --noEmit` 통과 후 커밋.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 추가.

## Verification 방식 (전 작업 공통)

- **타입체크:** `npx tsc --noEmit` → 기대: 출력 없음(오류 0), 종료코드 0.
- **빌드(해당 작업만):** `npm run build` → 기대: "Compiled successfully" 로그.
- **수동 확인:** `npm run dev` 실행 후 브라우저 `http://localhost:3000` 접속, 각 작업에 명시된 클릭·기대결과 확인.
- 순수 로직(`app/lib/guide-visibility.ts`)은 문서의 진리표로 검증한다.

---

## File Structure

- **수정** `app/lib/types.ts` — `AppStep` 축소, `GuidePage.activation` 추가, `FinalGuideResult.personalization_questions` 추가.
- **생성** `app/lib/guide-visibility.ts` — 답변 기준 페이지 표시 여부 판단(순수 함수). 외부 의존 없음(타입만 import).
- **수정** `app/lib/guide-generator.ts` — 답으로 필터링하지 않고 전부 생성 + `activation` 태그 + 질문 첨부.
- **수정** `app/page.tsx` — 업로드 후 parse→analyze→finalize 자동 실행, `answers` 상태, 인라인 수정 핸들러, 죽은 코드 제거, 설정 localStorage 저장.
- **생성** `app/ui/PersonalizePanel.tsx` — 안내서 최상단 "나에게 맞추기" 질문 묶음.
- **수정** `app/ui/GuideStep.tsx` — 표시 페이지 필터링, PersonalizePanel 장착, 고치기, 병원 전화·도움말.
- **수정** `app/ui/ProgressHeader.tsx` — 단계 단순화(2 단계 기준).
- **수정** `app/globals.css` — 글자 스케일 상향, 16px 미만 보조텍스트 상향, PersonalizePanel/고치기 스타일.
- **삭제** `app/ui/ReviewStep.tsx`, `app/ui/QuestionStep.tsx`.
- **API 변경 없음:** `app/api/finalize/route.ts`는 그대로 사용(빈 answers `{}`는 객체이므로 검증 통과).

---

## Task 1: 타입 확장 + 표시 판단 순수 로직

**Files:**
- Modify: `app/lib/types.ts`
- Create: `app/lib/guide-visibility.ts`

**Interfaces:**
- Produces:
  - `GuidePage.activation?: { question_id: string; values: string[] }`
  - `FinalGuideResult.personalization_questions: PersonalizationQuestion[]`
  - `AppStep = "upload" | "guide"`
  - `isPageVisible(page: GuidePage, answers: Record<string, string>): boolean`
  - `visiblePages(pages: GuidePage[], answers: Record<string, string>): GuidePage[]`

- [ ] **Step 1: `types.ts` 수정 — `GuidePage`에 `activation` 추가**

`app/lib/types.ts`의 `GuidePage` 인터페이스(현재 107-118행)에 마지막 필드 추가:

```typescript
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
  activation?: { question_id: string; values: string[] };
}
```

- [ ] **Step 2: `types.ts` 수정 — `FinalGuideResult`에 질문 목록 추가**

`FinalGuideResult`(현재 126-142행)에 `personalization_questions` 필드 추가:

```typescript
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
  personalization_questions: PersonalizationQuestion[];
  pages: GuidePage[];
  hospital_confirmation: HospitalConfirmation[];
  warnings: string[];
  footer: string;
}
```

- [ ] **Step 3: `types.ts` 수정 — `AppStep` 축소**

현재 195행 `export type AppStep = "upload" | "review" | "questions" | "guide";` 를 다음으로 교체:

```typescript
export type AppStep = "upload" | "guide";
```

- [ ] **Step 4: 순수 로직 모듈 생성**

`app/lib/guide-visibility.ts` 새 파일:

```typescript
import type { GuidePage } from "./types";

// 페이지를 현재 답변 기준으로 보여줄지 판단한다.
// - activation이 없으면 공통 안내이므로 항상 보인다.
// - activation이 있으면 해당 질문의 답이 values에 포함될 때만 보인다.
//   (아직 답하지 않았거나 매칭되지 않으면 숨긴다 → "네를 골라야 나온다")
export function isPageVisible(page: GuidePage, answers: Record<string, string>): boolean {
  if (!page.activation) return true;
  const answer = answers[page.activation.question_id];
  if (!answer) return false;
  return page.activation.values.includes(answer);
}

export function visiblePages(pages: GuidePage[], answers: Record<string, string>): GuidePage[] {
  return pages.filter((page) => isPageVisible(page, answers));
}
```

- [ ] **Step 5: 타입체크로 검증**

Run: `npx tsc --noEmit`
Expected: 출력 없음(오류 0).

- [ ] **Step 6: 진리표 확인 (수동)**

`isPageVisible` 동작을 다음 표로 확인한다(코드 눈으로 대조):

| page.activation | answers | 결과 |
|---|---|---|
| 없음 | `{}` | `true` (공통, 항상 표시) |
| `{question_id:"bp", values:["yes"]}` | `{}` | `false` (미응답 → 숨김) |
| `{question_id:"bp", values:["yes"]}` | `{bp:"yes"}` | `true` |
| `{question_id:"bp", values:["yes"]}` | `{bp:"no"}` | `false` |
| `{question_id:"ap", values:["morning"]}` | `{ap:"afternoon"}` | `false` |
| `{question_id:"ap", values:["morning"]}` | `{ap:"morning"}` | `true` |

- [ ] **Step 7: 커밋**

```bash
git add app/lib/types.ts app/lib/guide-visibility.ts
git commit -m "feat(types): add page activation model and visibility logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 안내서 생성기 — 전부 생성 + activation 태그

**Files:**
- Modify: `app/lib/guide-generator.ts`

**Interfaces:**
- Consumes: `GuidePage.activation`, `FinalGuideResult.personalization_questions` (Task 1)
- Produces: `buildFinalGuide(...)`가 답으로 필터링하지 않고 모든 검증된 안내문을 페이지로 만들며, 조건부 페이지에 `activation`을 채우고, 결과에 `personalization_questions`를 담는다.

- [ ] **Step 1: 활성화 값 계산 헬퍼 추가**

`app/lib/guide-generator.ts` 상단 import 아래(23행 `questionForCondition` 함수 앞)에 헬퍼 추가:

```typescript
// 이 안내문이 켜지는 답의 값 목록을 계산한다.
function activatingValues(instruction: ExtractedInstruction): string[] {
  if (instruction.condition_id === "BLOOD_THINNER_COUNT") {
    return instruction.condition_value ? [instruction.condition_value] : ["one", "two_or_more"];
  }
  return [instruction.condition_value || "yes"];
}
```

- [ ] **Step 2: `buildFinalGuide` 본문 교체 — 필터링 제거, 전부 페이지화**

`buildFinalGuide` 함수(현재 115-214행) 전체를 다음으로 교체:

```typescript
export async function buildFinalGuide(
  document: DocumentSummary,
  questions: PersonalizationQuestion[],
  instructions: ExtractedInstruction[],
  _answers: Record<string, string>,
): Promise<FinalGuideResult> {
  // 답으로 사전 필터링하지 않는다. 검증된 안내문은 모두 페이지로 만들고,
  // 조건부 안내문에는 activation을 붙여 화면에서 실시간으로 걸러지게 한다.
  const included = instructions.filter((instruction) => instruction.source_verified);

  const ordered = included.sort((left, right) =>
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
    const isConditional = instruction.applicability !== "all" && instruction.condition_id !== "NO_CONDITION";
    // 조건부이면서 매칭되는 질문이 있을 때만 activation을 붙인다.
    // 질문이 없으면 개인화할 방법이 없으므로 공통 안내로 항상 보여준다(안전).
    const activation = isConditional && question
      ? { question_id: question.question_id, values: activatingValues(instruction) }
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
      personalized_by: question ? [question.question_id] : [],
      personalization_note: question ? personalizationNote(instruction) : "",
      activation,
    };
  });

  const summary = questions.map((question) => ({
    label: question.question.replace(/[?？]/g, ""),
    value: "화면에서 답한 내용에 맞춰요",
  }));

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
    applied_answers: [],
    personalization_questions: questions,
    pages: [cover, ...pages].slice(0, 24),
    hospital_confirmation: included
      .filter((instruction) => instruction.applicability === "confirm_with_hospital")
      .map((instruction) => ({
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
```

- [ ] **Step 3: 사용하지 않게 된 `answerApplies` 정리 확인**

`answerApplies` 함수는 더 이상 호출되지 않는다. `npx tsc --noEmit`는 미사용 함수를 오류로 보지 않지만, `next lint`가 경고할 수 있다. 함수 위에 다음 주석을 추가해 의도를 남긴다(삭제하지 않음 — 향후 confirm 로직 재사용 가능):

```typescript
// NOTE: 신규 인라인 개인화 모델에서는 사용하지 않음. 향후 confirm 세분화 시 재사용 가능.
function answerApplies(instruction: ExtractedInstruction, answer: string | undefined): "include" | "exclude" | "confirm" {
```

만약 `next lint`가 미사용으로 빌드를 막으면, 파일 상단에 해당 함수만 지우는 대신 `void answerApplies;`를 파일 끝에 추가한다.

- [ ] **Step 4: 타입체크 + 빌드 검증**

Run: `npx tsc --noEmit`
Expected: 오류 0.

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 5: 커밋**

```bash
git add app/lib/guide-generator.ts
git commit -m "feat(guide): generate all conditional pages with activation tags

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 페이지 상태·흐름 단순화 (`page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `isPageVisible`/`visiblePages` 미사용(필터는 GuideStep에서). `FinalGuideResult.personalization_questions`, `AppStep`(Task 1), `buildFinalGuide` 결과(Task 2).
- Produces: 업로드→안내서 자동 파이프라인, `answers` 상태와 `setAnswer(questionId, value)`, `changeDocumentField(field, value)`, 설정 localStorage 저장.

- [ ] **Step 1: import에서 삭제될 컴포넌트 제거**

`app/page.tsx` 상단 import(13-17행)에서 `ReviewStep`, `QuestionStep` 줄 삭제:

```typescript
import GuideStep from "./ui/GuideStep";
import ProgressHeader from "./ui/ProgressHeader";
import UploadStep, { type UploadFile } from "./ui/UploadStep";
```

- [ ] **Step 2: 단계·질문 관련 상태 제거하고 answers 상태 추가**

현재 28-42행의 상태 선언 블록에서 다음을 정리한다.
- 유지: `files`, `filesRef`, `analysis`, `sourceContent`, `guide`, `pageIndex`, `overview`, `stage`, `loadingProgress`, `error`, `fontSize`, `highContrast`.
- 변경: `const [step, setStep] = useState<AppStep>("upload");` 는 그대로 둔다(값은 "upload"|"guide"만 사용).
- 삭제: `const [questionIndex, setQuestionIndex] = useState(0);`
- 추가(‘answers’): `guide` 선언 아래에 추가

```typescript
  const [answers, setAnswers] = useState<Record<string, string>>({});
```

- [ ] **Step 3: 접근성 설정 localStorage 저장/복원**

현재 46-49행의 `useEffect`(dataset 반영) 바로 위에 복원 effect를 추가하고, 아래에 저장 로직을 합친다. 46-49행 effect를 다음으로 교체:

```typescript
  useEffect(() => {
    const savedFont = window.localStorage.getItem("miribom.fontSize");
    const savedContrast = window.localStorage.getItem("miribom.contrast");
    if (savedFont === "normal" || savedFont === "large" || savedFont === "xlarge") setFontSize(savedFont);
    if (savedContrast === "high") setHighContrast(true);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
    window.localStorage.setItem("miribom.fontSize", fontSize);
    window.localStorage.setItem("miribom.contrast", highContrast ? "high" : "normal");
  }, [fontSize, highContrast]);
```

- [ ] **Step 4: `analyze()`를 전체 파이프라인으로 확장**

현재 `analyze()`(114-144행)에서, 분석 성공 후 `setStep("review")` 대신 곧바로 안내서를 생성하도록 바꾼다. 함수 끝부분(133-139행)을 다음으로 교체:

```typescript
      const nextAnalysis = await analyzeResponse.json() as AnalysisResult;
      setAnalysis(nextAnalysis);
      setAnswers({});

      setStage("generating");
      const finalizeResponse = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: nextAnalysis.document,
          questions: nextAnalysis.personalization_questions,
          instructions: nextAnalysis.instructions,
          answers: {},
        }),
      });
      if (!finalizeResponse.ok) throw new Error(await readError(finalizeResponse));
      const result = await finalizeResponse.json() as FinalGuideResult;
      setGuide(result);
      setPageIndex(0);
      setOverview(false);
      await finishLoadingProgress();
      setStage("done");
      setStep("guide");
```

- [ ] **Step 5: 죽은 핸들러 제거, 새 핸들러 추가**

다음 함수들을 삭제한다: `generateGuide`(146-173행), `startQuestions`(175-183행), `answerQuestion`(185-195행), `backQuestion`(197-200행).

`restart()` 함수(228-238행) 안의 상태 초기화에 `setAnswers({});` 를 추가한다.

`restart()` 아래에 새 핸들러 2개 추가:

```typescript
  function setAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function changeDocumentField(
    field: "procedure_name" | "hospital_name" | "procedure_date" | "appointment_time",
    value: string,
  ) {
    setGuide((current) => current ? { ...current, project: { ...current.project, [field]: value } } : current);
  }
```

- [ ] **Step 6: 렌더 트리에서 review/questions 분기 제거, GuideStep에 props 전달**

현재 262-299행의 `mainViewport` 안 분기에서 `step === "review"`와 `step === "questions"` 블록(264-283행)을 통째로 삭제한다. `step === "guide"` 블록(284-299행)을 다음으로 교체(새 props 추가):

```typescript
        {step === "guide" && guide && (
          <GuideStep
            guide={guide}
            answers={answers}
            pageIndex={pageIndex}
            overview={overview}
            onAnswer={setAnswer}
            onChangeField={changeDocumentField}
            onPage={setPageIndex}
            onOverview={() => setOverview((value) => !value)}
            onListenPage={speakPage}
            onListenAll={speakAll}
            onRestart={restart}
            onPrint={() => window.print()}
            documentText={sourceContent}
            onSpeak={speak}
          />
        )}
```

참고: `onEditAnswers` prop은 제거된다(질문 단계가 없어짐). `hospital_phone`은 `guide.project`에 없으므로 GuideStep은 `guide` 외에 전화번호가 필요하면 `analysis?.document.hospital_phone`를 쓰도록 Step 7에서 별도 prop으로 넘긴다. 위 블록에 다음 한 줄을 `documentText` 아래에 추가:

```typescript
            hospitalPhone={analysis?.document.hospital_phone ?? ""}
```

- [ ] **Step 7: `currentQuestion` 등 미사용 변수 제거**

현재 242행 `const currentQuestion = analysis?.personalization_questions[questionIndex];` 를 삭제한다.

- [ ] **Step 8: 타입체크 검증**

Run: `npx tsc --noEmit`
Expected: 오류 0. (GuideStep의 새 props는 Task 4에서 정의하므로, Task 4 완료 전에는 GuideStep prop 타입 불일치 오류가 날 수 있다. 이 경우 Task 4를 먼저 끝내고 함께 타입체크한다. 순서상 Task 3→4 연속 진행 권장.)

- [ ] **Step 9: 커밋**

```bash
git add app/page.tsx
git commit -m "refactor(flow): collapse to upload->guide with inline answers state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: "나에게 맞추기" 패널 컴포넌트

**Files:**
- Create: `app/ui/PersonalizePanel.tsx`

**Interfaces:**
- Consumes: `PersonalizationQuestion`(types), `answers`, `onAnswer(questionId, value)`.
- Produces: `default function PersonalizePanel(props: { questions: PersonalizationQuestion[]; answers: Record<string,string>; onAnswer: (questionId: string, value: string) => void; onSpeak: (text: string) => void; })`

- [ ] **Step 1: 컴포넌트 생성**

`app/ui/PersonalizePanel.tsx` 새 파일:

```tsx
"use client";

import type { PersonalizationQuestion } from "@/app/lib/types";

interface Props {
  questions: PersonalizationQuestion[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onSpeak: (text: string) => void;
}

export default function PersonalizePanel({ questions, answers, onAnswer, onSpeak }: Props) {
  if (!questions.length) return null;
  const answeredCount = questions.filter((question) => answers[question.question_id]).length;

  return (
    <section className="personalizePanel" aria-labelledby="personalize-heading">
      <div className="personalizeIntro">
        <p className="eyebrow">나에게 맞추기</p>
        <h2 id="personalize-heading">나에게 해당하는 것을 골라 주세요</h2>
        <p className="personalizeHelp">고른 내용에 맞춰 아래 안내가 바뀌어요. 언제든 다시 고를 수 있어요.</p>
        <strong className="personalizeCount" aria-live="polite">{questions.length}개 중 {answeredCount}개 골랐어요</strong>
      </div>

      <ul className="personalizeList">
        {questions.map((question) => {
          const selected = answers[question.question_id];
          const answered = Boolean(selected);
          return (
            <li key={question.question_id} className={answered ? "personalizeCard answered" : "personalizeCard"}>
              <div className="personalizeQuestion">
                <h3>{question.question}</h3>
                {question.helper_text && <p>{question.helper_text}</p>}
                <button
                  type="button"
                  className="personalizeListen"
                  onClick={() => onSpeak(`${question.question}. ${question.helper_text}`)}
                >
                  ▶ 질문 읽기
                </button>
              </div>
              <div className="personalizeChoices">
                {question.options.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={selected === option.value ? "personalizeChoice selected" : "personalizeChoice"}
                    aria-pressed={selected === option.value}
                    onClick={() => onAnswer(question.question_id, option.value)}
                  >
                    <span aria-hidden="true">{option.symbol}</span>
                    <b>{option.label}</b>
                  </button>
                ))}
              </div>
              {!answered && <p className="personalizeUnanswered" role="status">아직 안 골랐어요</p>}
              {selected === "unknown" && (
                <p className="personalizeConfirm" role="status">잘 모르겠으면 병원에 확인해 주세요.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: 타입체크 검증**

Run: `npx tsc --noEmit`
Expected: 오류 0(단, GuideStep이 아직 이 컴포넌트를 쓰지 않아도 무방).

- [ ] **Step 3: 커밋**

```bash
git add app/ui/PersonalizePanel.tsx
git commit -m "feat(ui): add PersonalizePanel for inline personalization

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: GuideStep 통합 (필터·고치기·전화·도움말)

**Files:**
- Modify: `app/ui/GuideStep.tsx`

**Interfaces:**
- Consumes: `visiblePages`(Task 1), `PersonalizePanel`(Task 4), 새 props(`answers`, `onAnswer`, `onChangeField`, `hospitalPhone`), `GuidePage.activation`.
- Produces: 필터링된 페이지만 표시하는 안내서 화면. `onEditAnswers` prop 제거.

- [ ] **Step 1: import과 Props 인터페이스 교체**

현재 1-27행을 다음으로 교체:

```tsx
"use client";

import { useState } from "react";
import type { FinalGuideResult, GuidePage } from "@/app/lib/types";
import { visiblePages } from "@/app/lib/guide-visibility";
import GuideChat from "./GuideChat";
import PictureCard from "./PictureCard";
import PersonalizePanel from "./PersonalizePanel";

const IMPORTANCE = {
  required: { symbol: "!", label: "꼭 지켜 주세요" },
  caution: { symbol: "△", label: "조심해 주세요" },
  ask_hospital: { symbol: "?", label: "병원에 물어보세요" },
  information: { symbol: "i", label: "알아두세요" },
};

interface Props {
  guide: FinalGuideResult;
  answers: Record<string, string>;
  pageIndex: number;
  overview: boolean;
  onAnswer: (questionId: string, value: string) => void;
  onChangeField: (
    field: "procedure_name" | "hospital_name" | "procedure_date" | "appointment_time",
    value: string,
  ) => void;
  onPage: (index: number) => void;
  onOverview: () => void;
  onListenPage: (page: GuidePage) => void;
  onListenAll: () => void;
  onRestart: () => void;
  onPrint: () => void;
  documentText: string;
  hospitalPhone: string;
  onSpeak: (text: string) => void;
}
```

- [ ] **Step 2: `GuidePageView`에 위치 표시 prop 추가**

현재 35행 `function GuidePageView({ page, total, onListen }: { page: GuidePage; total: number; onListen: () => void }) {` 를 다음으로 교체하고, 43행 `<small>{page.page_number} / {total}</small>` 를 `<small>{position} / {total}</small>` 로 바꾼다:

```tsx
function GuidePageView({ page, position, total, onListen }: { page: GuidePage; position: number; total: number; onListen: () => void }) {
```

- [ ] **Step 3: 컴포넌트 본문 교체 — 필터링·패널·고치기·전화**

현재 `GuideStep` 함수(58-117행) 전체를 다음으로 교체:

```tsx
export default function GuideStep({
  guide,
  answers,
  pageIndex,
  overview,
  onAnswer,
  onChangeField,
  onPage,
  onOverview,
  onListenPage,
  onListenAll,
  onRestart,
  onPrint,
  documentText,
  hospitalPhone,
  onSpeak,
}: Props) {
  const [editing, setEditing] = useState(false);
  const shown = visiblePages(guide.pages, answers);
  const safeIndex = Math.min(pageIndex, Math.max(0, shown.length - 1));
  const page = shown[safeIndex];

  return (
    <section className="guideScreen" aria-labelledby="guide-heading">
      <div className="guideToolbar">
        <div>
          <p className="eyebrow">나를 위한 쉬운 안내서</p>
          <h1 id="guide-heading">{guide.project.procedure_name} 준비 안내</h1>
          {!editing ? (
            <button type="button" className="editToggle" onClick={() => setEditing(true)}>내용 고치기</button>
          ) : (
            <div className="editFields">
              <label>검사 이름<input value={guide.project.procedure_name} onChange={(event) => onChangeField("procedure_name", event.target.value)} /></label>
              <label>병원<input value={guide.project.hospital_name} onChange={(event) => onChangeField("hospital_name", event.target.value)} /></label>
              <label>검사 날짜<input value={guide.project.procedure_date} onChange={(event) => onChangeField("procedure_date", event.target.value)} /></label>
              <label>예약 시간<input value={guide.project.appointment_time} onChange={(event) => onChangeField("appointment_time", event.target.value)} /></label>
              <button type="button" className="editDone" onClick={() => setEditing(false)}>다 고쳤어요</button>
            </div>
          )}
        </div>
        <div className="guideActions">
          <button type="button" onClick={onListenAll}>▶ 처음부터 읽기</button>
          <button type="button" onClick={onOverview}>{overview ? "한 장씩 보기" : "전체 페이지"}</button>
          <button className="pdfButton" type="button" onClick={onPrint}>PDF로 저장하기</button>
        </div>
      </div>

      <PersonalizePanel
        questions={guide.personalization_questions}
        answers={answers}
        onAnswer={onAnswer}
        onSpeak={onSpeak}
      />

      {overview ? (
        <div className="pageOverview">
          {shown.map((item, index) => (
            <button type="button" key={`${item.section}-${item.page_number}`} onClick={() => { onPage(index); onOverview(); }}>
              <span>{index + 1}쪽 · {item.section}</span><b>{item.title}</b>
            </button>
          ))}
        </div>
      ) : page ? (
        <div className="bookViewer">
          <button className="pageArrow previous" type="button" disabled={safeIndex === 0} onClick={() => onPage(safeIndex - 1)} aria-label="이전 페이지">‹</button>
          <GuidePageView page={page} position={safeIndex + 1} total={shown.length} onListen={() => onListenPage(page)} />
          <button className="pageArrow next" type="button" disabled={safeIndex === shown.length - 1} onClick={() => onPage(safeIndex + 1)} aria-label="다음 페이지">›</button>
        </div>
      ) : (
        <p className="guideEmpty" role="status">위에서 나에게 해당하는 것을 고르면 안내가 나타나요.</p>
      )}

      <div className="guideHelp">
        {hospitalPhone
          ? <a className="callHospital" href={`tel:${hospitalPhone.replace(/[^0-9+]/g, "")}`}>☎ 병원에 전화하기 ({hospitalPhone})</a>
          : <span className="callHospitalNote">궁금하면 병원에 전화해 확인해 주세요.</span>}
        <p className="guideHelpText">잘 모르는 내용은 병원에 물어보세요. 아래 물음표 버튼으로 안내문에 바로 물어볼 수도 있어요.</p>
      </div>

      <div className="guideBottomActions">
        <GuideChat guide={guide} documentText={documentText} onSpeak={onSpeak} />
        <button type="button" onClick={onRestart}>새 안내문 만들기</button>
      </div>

      <div className="printOnly">
        {shown.map((item, index) => <GuidePageView key={`print-${item.page_number}`} page={item} position={index + 1} total={shown.length} onListen={() => undefined} />)}
        {guide.hospital_confirmation.length > 0 && (
          <article className="guidePage ask_hospital confirmationPage">
            <header className="guidePageHeader"><div><span>병원에 확인할 내용</span></div></header>
            <div className="confirmationList">{guide.hospital_confirmation.map((item, index) => <div key={`${item.title}-${index}`}><h2>{item.title}</h2><p>{item.body}</p></div>)}</div>
          </article>
        )}
        <p className="printFooter">{guide.footer}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 타입체크 + 빌드 검증**

Run: `npx tsc --noEmit`
Expected: 오류 0. (Task 3의 `page.tsx`가 넘기는 props와 정확히 일치해야 한다: `answers`, `onAnswer`, `onChangeField`, `hospitalPhone` 있음 / `onEditAnswers` 없음.)

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 5: 개발서버 수동 확인**

Run: `npm run dev`
확인:
1. 안내문 업로드 → 중간 단계 없이 "만드는 중" 후 안내서로 진입.
2. 안내서 맨 위 "나에게 맞추기"에서 질문에 "네" → 관련 안내 페이지가 나타남.
3. 같은 질문 "아니오" → 그 페이지가 사라짐. 다시 "네" → 다시 나타남(되돌리기).
4. "내용 고치기" → 검사명 수정 → 제목이 바뀜.
5. 하단 "병원에 전화하기" 링크 표시(번호 있으면 tel 링크).

- [ ] **Step 6: 커밋**

```bash
git add app/ui/GuideStep.tsx
git commit -m "feat(ui): inline personalization, edit-in-place, hospital contact in guide

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 진행 표시 단순화 (`ProgressHeader.tsx`)

**Files:**
- Modify: `app/ui/ProgressHeader.tsx`

**Interfaces:**
- Consumes: `AppStep = "upload" | "guide"`(Task 1).
- Produces: 2단계 기준 진행 표시.

- [ ] **Step 1: STEPS와 STEP_INDEX 교체**

현재 5-13행을 다음으로 교체:

```tsx
const STEPS = [
  { key: "upload", label: "안내문 올리기" },
  { key: "guide", label: "쉬운 안내서" },
] as const;

const STEP_INDEX: Record<AppStep, number> = { upload: 0, guide: 1 };
```

- [ ] **Step 2: 타입체크 검증**

Run: `npx tsc --noEmit`
Expected: 오류 0.

- [ ] **Step 3: 커밋**

```bash
git add app/ui/ProgressHeader.tsx
git commit -m "refactor(ui): simplify progress header to two steps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 글자·설정 스타일 + 패널 스타일 (`globals.css`)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: PersonalizePanel/GuideStep의 새 클래스명.
- Produces: 상향된 글자 스케일, 16px 이상 보조텍스트, 신규 컴포넌트 스타일.

- [ ] **Step 1: 글자 기본·스케일 상향**

현재 24-25행:

```css
[data-font-size="large"] { --base-scale: 1.13; }
[data-font-size="xlarge"] { --base-scale: 1.28; }
```

을 다음으로 교체:

```css
[data-font-size="large"] { --base-scale: 1.25; }
[data-font-size="xlarge"] { --base-scale: 1.5; }
```

현재 44행 `html { font-size: calc(16px * var(--base-scale)); }` 를 다음으로 교체:

```css
html { font-size: calc(18px * var(--base-scale)); }
```

- [ ] **Step 2: 16px(=0.888rem 기준) 미만 보조텍스트 상향**

다음 선언들의 `font-size`를 1rem 이상으로 올린다(값만 교체):
- 93행 `.accessTools > span { ... font-size: .85rem; ... }` → `font-size: 1rem;`
- 96-103행 `.accessTools button { ... font-size: .88rem; ... }` → `font-size: 1rem;`
- 547-556행 `.chatSafety { ... font-size: .84rem; ... }` → `font-size: 1rem;`
- 449-455행 `.chatMessage > small { ... font-size: .84rem; ... }` → `font-size: 1rem;`
- 211-213행 `.fileInfo span { ... font-size: .85rem; ... }` → `font-size: 1rem;`
- 488-489행 `.chatEvidence blockquote b { ... .85rem }`, `.chatEvidence blockquote p { ... .95rem }` → 각각 `1rem`.

(정확히 해당 줄의 `font-size` 값만 위 값으로 바꾼다. 다른 속성은 유지.)

- [ ] **Step 3: 신규 컴포넌트 스타일 추가**

`globals.css` 맨 끝(693행 이후)에 아래 블록을 추가:

```css
/* 나에게 맞추기 패널 */
.personalizePanel { margin: 0 0 28px; padding: 24px; background: var(--blue-soft); border: 3px solid var(--blue); border-radius: 18px; }
.personalizeIntro h2 { margin: 6px 0 8px; font-size: 1.6rem; letter-spacing: -.03em; }
.personalizeHelp { margin: 0; color: var(--ink); font-size: 1.1rem; line-height: 1.5; font-weight: 650; }
.personalizeCount { display: inline-block; margin-top: 12px; color: var(--blue-dark); font-size: 1.05rem; font-weight: 900; }
.personalizeList { display: grid; gap: 16px; margin: 20px 0 0; padding: 0; list-style: none; }
.personalizeCard { padding: 20px; background: var(--paper); border: 3px solid var(--line); border-radius: 14px; }
.personalizeCard.answered { border-color: var(--green); }
.personalizeQuestion h3 { margin: 0 0 6px; font-size: 1.35rem; letter-spacing: -.03em; }
.personalizeQuestion p { margin: 0 0 6px; color: var(--muted); font-size: 1.05rem; line-height: 1.5; font-weight: 650; }
.personalizeListen { min-height: 44px; padding: 0 14px; color: var(--blue-dark); background: var(--blue-soft); border: 2px solid var(--blue); border-radius: 9px; font-size: 1rem; font-weight: 900; cursor: pointer; }
.personalizeChoices { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
.personalizeChoice { min-height: 72px; min-width: 130px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 18px; background: var(--paper); border: 3px solid var(--blue); border-radius: 14px; cursor: pointer; }
.personalizeChoice span { width: 40px; height: 40px; display: grid; place-items: center; color: var(--white); background: var(--blue); border-radius: 50%; font-size: 1.4rem; font-weight: 950; }
.personalizeChoice b { font-size: 1.2rem; }
.personalizeChoice.selected { background: var(--blue-soft); box-shadow: inset 0 0 0 3px var(--blue-dark); }
.personalizeUnanswered { margin: 12px 0 0; color: var(--amber); font-size: 1rem; font-weight: 900; }
.personalizeConfirm { margin: 12px 0 0; color: var(--amber); font-size: 1rem; font-weight: 800; }

/* 안내서 내 고치기 */
.editToggle { min-height: 48px; margin-top: 10px; padding: 0 16px; color: var(--blue-dark); background: var(--paper); border: 2px solid var(--blue); border-radius: 10px; font-size: 1rem; font-weight: 900; cursor: pointer; }
.editFields { display: grid; gap: 10px; margin-top: 12px; }
.editFields label { display: grid; gap: 6px; color: var(--muted); font-size: 1rem; font-weight: 800; }
.editFields input { min-height: 52px; padding: 0 12px; color: var(--ink); background: var(--blue-soft); border: 2px solid var(--blue); border-radius: 8px; font-size: 1.15rem; font-weight: 800; }
.editDone { min-height: 52px; color: var(--white); background: var(--green); border: 0; border-radius: 10px; font-size: 1.05rem; font-weight: 900; cursor: pointer; }

/* 안내서 도움·전화 */
.guideEmpty { margin: 24px 0; padding: 24px; text-align: center; color: var(--blue-dark); background: var(--blue-soft); border: 2px dashed var(--blue); border-radius: 14px; font-size: 1.2rem; font-weight: 800; }
.guideHelp { margin-top: 22px; padding: 18px 20px; background: var(--green-soft); border-left: 6px solid var(--green); border-radius: 10px; }
.callHospital { display: inline-block; min-height: 56px; padding: 14px 20px; color: var(--white); background: var(--green); border-radius: 12px; font-size: 1.2rem; font-weight: 900; text-decoration: none; }
.callHospitalNote { display: inline-block; color: var(--ink); font-size: 1.1rem; font-weight: 800; }
.guideHelpText { margin: 12px 0 0; color: var(--ink); font-size: 1.05rem; line-height: 1.5; font-weight: 650; }
```

- [ ] **Step 4: 빌드 + 수동 확인**

Run: `npm run build`
Expected: "Compiled successfully".

Run: `npm run dev` → 확인:
1. 헤더 "크게"/"더 크게" 클릭 시 글자가 눈에 띄게 커짐(1.25/1.5배).
2. 새로고침해도 글자 크기·고대비 설정이 유지됨(localStorage).
3. "나에게 맞추기" 패널, 고치기 입력, 병원 전화 버튼이 스타일 적용되어 보임.

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css
git commit -m "style: larger type scale, min 16px helper text, panel styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 사용하지 않는 단계 컴포넌트 삭제 + 최종 검증

**Files:**
- Delete: `app/ui/ReviewStep.tsx`, `app/ui/QuestionStep.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
git rm app/ui/ReviewStep.tsx app/ui/QuestionStep.tsx
```

- [ ] **Step 2: 참조가 남아있지 않은지 확인**

`ReviewStep` 또는 `QuestionStep` 문자열이 코드에 남아있지 않은지 검색한다(Grep). 남아있으면 제거한다. (Task 3에서 import는 이미 삭제됨.)

- [ ] **Step 3: 최종 타입체크 + 빌드**

Run: `npx tsc --noEmit`
Expected: 오류 0.

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: 전체 흐름 수동 확인**

Run: `npm run dev` → 처음부터 끝까지 확인:
1. 업로드 → 안내서 자동 생성(2단계).
2. 진행 표시가 "안내문 올리기 → 쉬운 안내서" 2단계로 보임.
3. "나에게 맞추기"로 네/아니오 → 안내 표시/숨김/되돌리기.
4. 내용 고치기, 병원 전화, 처음부터 읽기, PDF 저장, 안내문에 물어보기(챗봇) 정상.
5. 글자 크기·고대비 설정 유지.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore(ui): remove obsolete review/question step components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review 결과

- **Spec coverage:** 흐름 2단계화(Task 3,6), 인라인 개인화 A안(Task 1,2,4,5), 아니오=숨김/되돌리기(Task 1 visibility + Task 5), 안내서 내 고치기(Task 3,5), 병원 전화·도움말=표준10(Task 5,7), 글자·설정 표준화=표준1·7(Task 7), 컴포넌트 삭제(Task 8) 모두 대응됨.
- **Placeholder scan:** TBD/TODO 없음. 모든 코드 단계에 실제 코드 포함.
- **Type consistency:** `onAnswer(questionId, value)`, `onChangeField(field, value)`, `activation:{question_id, values}`, `hospitalPhone`, `personalization_questions` 이름이 Task 1·3·4·5 전반에서 일치. `GuidePageView`는 `position`+`total` 사용으로 통일.
- **알려진 트레이드오프:** (1) `answerApplies`의 confirm 세분화는 이번 범위에서 단순화(잘 모르겠어요→카드 안내). (2) 표지 페이지 title은 고치기 후 즉시 재생성되지 않음(툴바 제목만 갱신). 필요 시 후속 작업.
