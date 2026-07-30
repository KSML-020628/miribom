import type { FinalGuideResult, GuidePage, HospitalConfirmation } from "@/app/lib/types";
import PictureCard from "./PictureCard";

const IMPORTANCE = {
  required: { symbol: "!", label: "꼭 지켜 주세요" },
  caution: { symbol: "△", label: "조심해 주세요" },
  ask_hospital: { symbol: "?", label: "병원에 물어보세요" },
  information: { symbol: "i", label: "알아두세요" },
};

function PrintPage({
  page,
  position,
  total,
  footer,
}: {
  page: GuidePage;
  position: number;
  total: number;
  footer: string;
}) {
  const importance = IMPORTANCE[page.importance];

  return (
    <article className={`easyReadPrintPage ${page.importance}`}>
      <header className="easyReadPrintHeader">
        <b>미리봄</b>
        <span>{page.section}</span>
      </header>
      <main className="easyReadPrintMain">
        {page.when && <p className="easyReadPrintWhen">{page.when}</p>}
        <div className="easyReadPrintContent">
          <PictureCard tag={page.image_tag} size="large" />
          <div className="easyReadPrintCopy">
            <span className="easyReadPrintImportance">
              <b aria-hidden="true">{importance.symbol}</b>
              {importance.label}
            </span>
            <h2>{page.title}</h2>
            {page.body.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            {page.personalized && page.personalization_note && (
              <aside>{page.personalization_note}</aside>
            )}
          </div>
        </div>
      </main>
      <footer className="easyReadPrintFooter">
        <span>{footer}</span>
        <b>{position} / {total}</b>
      </footer>
    </article>
  );
}

function ConfirmationPage({
  item,
  position,
  total,
  footer,
}: {
  item: HospitalConfirmation;
  position: number;
  total: number;
  footer: string;
}) {
  return (
    <article className="easyReadPrintPage ask_hospital">
      <header className="easyReadPrintHeader">
        <b>미리봄</b>
        <span>병원에 확인할 내용</span>
      </header>
      <main className="easyReadPrintMain">
        <div className="easyReadPrintContent">
          <PictureCard tag={item.image_tag} size="large" />
          <div className="easyReadPrintCopy">
            <span className="easyReadPrintImportance"><b aria-hidden="true">?</b>병원에 물어보세요</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </div>
        </div>
      </main>
      <footer className="easyReadPrintFooter">
        <span>{footer}</span>
        <b>{position} / {total}</b>
      </footer>
    </article>
  );
}

export default function EasyReadPrintDocument({
  guide,
  pages,
  confirmations,
}: {
  guide: FinalGuideResult;
  pages: GuidePage[];
  confirmations: HospitalConfirmation[];
}) {
  const contentPages = pages.filter((page) => page.section !== "표지");
  const total = 1 + contentPages.length + confirmations.length;

  return (
    <section className="easyReadPrintDocument printOnly" aria-label="PDF 인쇄용 쉬운 안내서">
      <article className="easyReadPrintPage easyReadPrintCover">
        <header className="easyReadPrintHeader">
          <b>미리봄</b>
          <span>나를 위한 쉬운 검사 준비 안내</span>
        </header>
        <main>
          <p>병원 안내문을 쉽게 정리했어요</p>
          <PictureCard
            tag={guide.project.procedure_name.includes("대장") ? "COLONOSCOPY" : "GASTROSCOPY"}
            size="large"
          />
          <h1>{guide.project.procedure_name}<br />준비 안내</h1>
          <dl>
            {guide.project.procedure_date && <div><dt>검사 날짜</dt><dd>{guide.project.procedure_date}</dd></div>}
            <div><dt>검사 시간</dt><dd>{guide.project.appointment_time || "병원에 확인해 주세요"}</dd></div>
            {guide.project.hospital_name && <div><dt>병원</dt><dd>{guide.project.hospital_name}</dd></div>}
          </dl>
        </main>
        <footer className="easyReadPrintFooter">
          <span>병원에서 받은 원본 안내문도 함께 보관해 주세요.</span>
          <b>1 / {total}</b>
        </footer>
      </article>

      {contentPages.map((page, index) => (
        <PrintPage
          key={`print-${page.page_number}`}
          page={page}
          position={index + 2}
          total={total}
          footer={guide.footer}
        />
      ))}

      {confirmations.map((item, index) => (
        <ConfirmationPage
          key={`print-confirmation-${index}`}
          item={item}
          position={contentPages.length + index + 2}
          total={total}
          footer={guide.footer}
        />
      ))}
    </section>
  );
}
