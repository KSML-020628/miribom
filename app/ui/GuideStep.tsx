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

function compactWhen(section: string, when?: string): string {
  if (!when) return "";
  const trimmed = when.trim();
  return trimmed.startsWith(section) ? trimmed.slice(section.length).trim() : trimmed;
}

function GuidePageView({ page, position, total, onListen }: { page: GuidePage; position: number; total: number; onListen: () => void }) {
  const importance = IMPORTANCE[page.importance];
  const displayWhen = compactWhen(page.section, page.when);
  return (
    <article className={`guidePage ${page.importance}`}>
      <header className="guidePageHeader">
        <div><span>{page.section}</span>{displayWhen && <b>{displayWhen}</b>}</div>
        <small>{position} / {total}</small>
      </header>
      <div className="guidePageBody">
        <PictureCard tag={page.image_tag} />
        <div className="guideCopy">
          <span className="importanceLabel"><b aria-hidden="true">{importance.symbol}</b>{importance.label}</span>
          <h2>{page.title}</h2>
          {page.body.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          {page.personalized && page.personalization_note && <aside>맞춤 안내 · {page.personalization_note}</aside>}
        </div>
      </div>
      <button className="pageListen" type="button" onClick={onListen}>▶ 이 페이지 읽기</button>
    </article>
  );
}

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
