"use client";

import type { FinalGuideResult, ParsedPage } from "@/app/lib/types";
import GuideChat from "./GuideChat";
import GuideSection from "./GuideSection";

interface Props {
  guide: FinalGuideResult;
  onListenAll: () => void;
  onEditAnswers: () => void;
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
  onListenAll,
  onEditAnswers,
  onRestart,
  onPrint,
  documentPages,
  onSpeak,
  speaking,
  onStopSpeaking,
}: Props) {
  const groups = groupGuidePages(guide);
  const keyActions = guide.pages.filter((page) => page.section !== "표지").slice(0, 3);

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
        <button className="pdfButton" type="button" onClick={onPrint}>PDF 저장</button>
      </div>

      <article className="verticalGuideDocument">
        <header className="guideDocumentHeader">
          <p>나를 위한 쉬운 안내서</p>
          <h1 id="guide-heading" data-screen-title tabIndex={-1}>
            {guide.project.procedure_name}<br />준비 안내
          </h1>
          <dl>
            <div><dt>검사</dt><dd>{guide.project.procedure_name || "확인 필요"}</dd></div>
            <div><dt>시간</dt><dd>{guide.project.appointment_time || "확인 필요"}</dd></div>
            {guide.project.procedure_date && <div><dt>날짜</dt><dd>{guide.project.procedure_date}</dd></div>}
          </dl>
        </header>

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
            {guide.hospital_confirmation.length > 0 && (
              <button type="button" onClick={() => moveToSection("hospital-confirmation")}>병원 확인</button>
            )}
          </nav>
        )}

        <div className="guideSections">
          {groups.map((group) => (
            <GuideSection key={group.id} id={group.id} title={group.title} pages={group.pages} />
          ))}
        </div>

        {guide.hospital_confirmation.length > 0 && (
          <section className="guideSection hospitalConfirmation" id="hospital-confirmation" aria-labelledby="hospital-confirmation-heading">
            <h2 id="hospital-confirmation-heading">병원에 확인할 내용</h2>
            <div className="confirmationList">
              {guide.hospital_confirmation.map((item, index) => (
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
        <GuideChat guide={guide} documentPages={documentPages} onSpeak={onSpeak} speaking={speaking} onStopSpeak={onStopSpeaking} />
        <button type="button" onClick={onEditAnswers}>답변 다시 보기</button>
        <button type="button" onClick={onRestart}>새 안내문 만들기</button>
      </div>
    </section>
  );
}
