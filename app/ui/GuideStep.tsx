"use client";

import type { FinalGuideResult, GuidePage } from "@/app/lib/types";
import PictureCard from "./PictureCard";

const IMPORTANCE = {
  required: { symbol: "!", label: "꼭 지켜 주세요" },
  caution: { symbol: "△", label: "조심해 주세요" },
  ask_hospital: { symbol: "?", label: "병원에 물어보세요" },
  information: { symbol: "i", label: "알아두세요" },
};

interface Props {
  guide: FinalGuideResult;
  pageIndex: number;
  overview: boolean;
  onPage: (index: number) => void;
  onOverview: () => void;
  onListenPage: (page: GuidePage) => void;
  onListenAll: () => void;
  onEditAnswers: () => void;
  onRestart: () => void;
  onPrint: () => void;
}

function compactWhen(section: string, when?: string): string {
  if (!when) return "";
  const trimmed = when.trim();
  return trimmed.startsWith(section) ? trimmed.slice(section.length).trim() : trimmed;
}

function GuidePageView({ page, total, onListen }: { page: GuidePage; total: number; onListen: () => void }) {
  const importance = IMPORTANCE[page.importance];
  const displayWhen = compactWhen(page.section, page.when);
  return (
    <article className={`guidePage ${page.importance}`}>
      <header className="guidePageHeader">
        <div><span>{page.section}</span>{displayWhen && <b>{displayWhen}</b>}</div>
        <small>{page.page_number} / {total}</small>
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

export default function GuideStep({ guide, pageIndex, overview, onPage, onOverview, onListenPage, onListenAll, onEditAnswers, onRestart, onPrint }: Props) {
  const page = guide.pages[pageIndex];
  return (
    <section className="guideScreen" aria-labelledby="guide-heading">
      <div className="guideToolbar">
        <div><p className="eyebrow">나를 위한 쉬운 안내서</p><h1 id="guide-heading">{guide.project.procedure_name} 준비 안내</h1></div>
        <div className="guideActions">
          <button type="button" onClick={onListenAll}>▶ 처음부터 읽기</button>
          <button type="button" onClick={onOverview}>{overview ? "한 장씩 보기" : "전체 페이지"}</button>
          <button className="pdfButton" type="button" onClick={onPrint}>PDF로 저장하기</button>
        </div>
      </div>

      {overview ? (
        <div className="pageOverview">
          {guide.pages.map((item, index) => (
            <button type="button" key={item.page_number} onClick={() => { onPage(index); onOverview(); }}>
              <span>{item.page_number}쪽 · {item.section}</span><b>{item.title}</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="bookViewer">
          <button className="pageArrow previous" type="button" disabled={pageIndex === 0} onClick={() => onPage(pageIndex - 1)} aria-label="이전 페이지">‹</button>
          <GuidePageView page={page} total={guide.pages.length} onListen={() => onListenPage(page)} />
          <button className="pageArrow next" type="button" disabled={pageIndex === guide.pages.length - 1} onClick={() => onPage(pageIndex + 1)} aria-label="다음 페이지">›</button>
        </div>
      )}

      <div className="guideBottomActions">
        <button type="button" onClick={onEditAnswers}>답변 다시 보기</button>
        <button type="button" onClick={onRestart}>새 안내문 만들기</button>
      </div>

      <div className="printOnly">
        {guide.pages.map((item) => <GuidePageView key={item.page_number} page={item} total={guide.pages.length} onListen={() => undefined} />)}
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
