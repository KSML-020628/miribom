"use client";

import {
  buildSectionItems,
  visibleConfirmations,
  visiblePages,
} from "@/app/lib/guide-visibility";
import type { FinalGuideResult, ParsedPage } from "@/app/lib/types";
import EasyReadPrintDocument from "./EasyReadPrintDocument";
import GuideAnswerSummary from "./GuideAnswerSummary";
import GuideChat from "./GuideChat";
import GuideSection from "./GuideSection";

interface Props {
  guide: FinalGuideResult;
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onListenAll: () => void;
  onRestart: () => void;
  onPrint: () => void;
  documentPages: ParsedPage[];
  onSpeak: (text: string) => void;
  speaking: boolean;
  onStopSpeaking: () => void;
}

interface SectionGroup {
  id: string;
  title: string;
  pages: FinalGuideResult["pages"];
}

const PENDING_QUESTIONS_SECTION_ID = "guide-pending-questions";

function groupGuidePages(pages: FinalGuideResult["pages"]): SectionGroup[] {
  const groups = new Map<string, FinalGuideResult["pages"]>();
  for (const page of pages) {
    if (page.section === "표지") continue;
    const current = groups.get(page.section) || [];
    current.push(page);
    groups.set(page.section, current);
  }
  return [...groups.entries()].map(([title, groupPages], index) => ({
    id: `guide-section-${index + 1}`,
    title,
    pages: groupPages,
  }));
}

export default function GuideStep({
  guide,
  answers,
  onAnswer,
  onListenAll,
  onRestart,
  onPrint,
  documentPages,
  onSpeak,
  speaking,
  onStopSpeaking,
}: Props) {
  const shownPages = visiblePages(guide.pages, answers);
  const shownConfirmations = visibleConfirmations(guide.hospital_confirmation, answers);
  const shownGuide = {
    ...guide,
    pages: shownPages,
    hospital_confirmation: shownConfirmations,
  };

  // 답이 필요한 조건부 안내는 아직 보이지 않으므로, 질문 카드 배치는 전체(미필터) 페이지를 기준으로 계산한다.
  // 같은 질문이 여러 단계를 여는 경우에도 처음 등장하는 자리에만 카드를 한 번 끼워 넣는다.
  const placedQuestionIds = new Set<string>();
  const groups = groupGuidePages(guide.pages)
    .map((group) => ({
      ...group,
      items: buildSectionItems(group.pages, guide.personalization_questions, answers, placedQuestionIds),
    }))
    .filter((group) => group.items.length > 0);

  const orphanQuestions = guide.personalization_questions.filter(
    (question) => !answers[question.question_id] && !placedQuestionIds.has(question.question_id),
  );

  const questionSectionId = new Map<string, string>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === "question") questionSectionId.set(item.question.question_id, group.id);
    }
  }
  for (const question of orphanQuestions) questionSectionId.set(question.question_id, PENDING_QUESTIONS_SECTION_ID);

  const keyActions = shownPages.filter((page) => page.section !== "표지").slice(0, 3);

  function moveToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function editAnswer(questionId: string) {
    onAnswer(questionId, "");
    window.setTimeout(() => {
      const sectionId = questionSectionId.get(questionId);
      if (sectionId) moveToSection(sectionId);
    }, 60);
  }

  return (
    <section className="verticalGuideScreen" aria-labelledby="guide-heading">
      <div className="guideStickyToolbar interactiveOnly" aria-label="안내서 도구">
        <button type="button" onClick={speaking ? onStopSpeaking : onListenAll}>
          <span aria-hidden="true">{speaking ? "⏹" : "🔊"}</span>
          {speaking ? "멈추기" : "전체 듣기"}
        </button>
        <div className="pdfAction">
          <button className="pdfButton" type="button" onClick={onPrint}>PDF 저장</button>
          <small>저장 창에서 ‘머리글과 바닥글’을 꺼 주세요.</small>
        </div>
      </div>

      <article className="verticalGuideDocument screenOnly">
        <header className="guideDocumentHeader">
          <p>나만의 안내서</p>
          <h1 id="guide-heading" data-screen-title tabIndex={-1}>
            {guide.project.procedure_name}<br />준비 안내
          </h1>
          <dl>
            <div><dt>검사</dt><dd>{guide.project.procedure_name || "확인 필요"}</dd></div>
            <div><dt>시간</dt><dd>{guide.project.appointment_time || "확인 필요"}</dd></div>
            {guide.project.procedure_date && <div><dt>날짜</dt><dd>{guide.project.procedure_date}</dd></div>}
          </dl>
        </header>

        <GuideAnswerSummary
          questions={guide.personalization_questions}
          answers={answers}
          onEdit={editAnswer}
        />

        {keyActions.length > 0 && (
          <section className="guideKeySummary" aria-labelledby="key-summary-heading">
            <h2 id="key-summary-heading">꼭 기억하세요</h2>
            <ul>
              {keyActions.map((page) => (
                <li key={page.page_number}>
                  <b>{page.when || page.section}</b>
                  <span>{page.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(groups.length > 1 || orphanQuestions.length > 0) && (
          <nav className="guideToc interactiveOnly" aria-label="안내서 빠른 이동">
            {orphanQuestions.length > 0 && (
              <button type="button" onClick={() => moveToSection(PENDING_QUESTIONS_SECTION_ID)}>확인이 필요한 질문</button>
            )}
            {groups.map((group) => (
              <button type="button" key={group.id} onClick={() => moveToSection(group.id)}>
                {group.title}
              </button>
            ))}
            {shownConfirmations.length > 0 && (
              <button type="button" onClick={() => moveToSection("hospital-confirmation")}>병원 확인</button>
            )}
          </nav>
        )}

        <div className="guideSections">
          {orphanQuestions.length > 0 && (
            <GuideSection
              id={PENDING_QUESTIONS_SECTION_ID}
              title="확인이 필요한 질문"
              items={orphanQuestions.map((question) => ({ kind: "question" as const, question }))}
              onAnswer={onAnswer}
              onSpeak={onSpeak}
            />
          )}
          {groups.map((group) => (
            <GuideSection
              key={group.id}
              id={group.id}
              title={group.title}
              items={group.items}
              onAnswer={onAnswer}
              onSpeak={onSpeak}
            />
          ))}
        </div>

        {shownConfirmations.length > 0 && (
          <section className="guideSection hospitalConfirmation" id="hospital-confirmation" aria-labelledby="hospital-confirmation-heading">
            <h2 id="hospital-confirmation-heading">병원에 확인할 내용</h2>
            <div className="confirmationList">
              {shownConfirmations.map((item, index) => (
                <article key={`${item.title}-${index}`}>
                  <span aria-hidden="true">?</span>
                  <div><h3>{item.title}</h3><p>{item.body}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="guideDocumentFooter">{guide.footer}</footer>
      </article>

      <div className="guideBottomActions interactiveOnly">
        <GuideChat guide={shownGuide} documentPages={documentPages} onSpeak={onSpeak} speaking={speaking} onStopSpeak={onStopSpeaking} />
        <button type="button" onClick={onRestart}>새 안내문 만들기</button>
      </div>

      <EasyReadPrintDocument
        guide={guide}
        pages={shownPages}
        confirmations={shownConfirmations}
      />
    </section>
  );
}
