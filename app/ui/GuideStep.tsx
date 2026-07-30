"use client";

import {
  visibleConfirmations,
  visiblePages,
} from "@/app/lib/guide-visibility";
import type { FinalGuideResult, ParsedPage } from "@/app/lib/types";
import EasyReadPrintDocument from "./EasyReadPrintDocument";
import GuideChat from "./GuideChat";
import GuideSection from "./GuideSection";
import PersonalizePanel from "./PersonalizePanel";

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

function groupGuidePages(guide: FinalGuideResult): SectionGroup[] {
  const groups = new Map<string, FinalGuideResult["pages"]>();
  for (const page of guide.pages) {
    if (page.section === "표지") continue;
    const current = groups.get(page.section) || [];
    current.push(page);
    groups.set(page.section, current);
  }
  return [...groups.entries()].map(([title, pages], index) => ({
    id: `guide-section-${index + 1}`,
    title,
    pages,
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
  const groups = groupGuidePages(shownGuide);
  const keyActions = shownPages.filter((page) => page.section !== "표지").slice(0, 3);

  function moveToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

        <PersonalizePanel
          questions={guide.personalization_questions}
          answers={answers}
          onAnswer={onAnswer}
          onSpeak={onSpeak}
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

        {groups.length > 1 && (
          <nav className="guideToc interactiveOnly" aria-label="안내서 빠른 이동">
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
          {groups.map((group) => (
            <GuideSection key={group.id} id={group.id} title={group.title} pages={group.pages} />
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
