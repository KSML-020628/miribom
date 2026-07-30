"use client";

import type { AnalysisResult, DocumentSummary } from "@/app/lib/types";
import { roleLabel } from "@/app/lib/document-merge";

interface Props {
  analysis: AnalysisResult;
  onChangeField: (field: keyof Pick<DocumentSummary, "procedure_name" | "hospital_name" | "procedure_date" | "appointment_time">, value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onListen: () => void;
}

export default function ReviewStep({ analysis, onChangeField, onConfirm, onBack, onListen }: Props) {
  const { document } = analysis;
  const reliability = document.source_reliability === "clear" ? "글자를 잘 읽었어요" : "확인이 필요한 글자가 있어요";
  return (
    <section className="stepScreen reviewStep" aria-labelledby="review-heading">
      <div className="topTools">
        <button type="button" onClick={onBack}>← 다시 올리기</button>
        <button type="button" onClick={onListen}>▶ 화면 읽기</button>
      </div>
      <div className="screenIntro centered">
        <p className="eyebrow">안내문 확인</p>
        <h1 id="review-heading">이 안내문이 맞나요?</h1>
        <p>틀린 내용이 있으면 검사 이름을 고쳐 주세요.</p>
      </div>
      <div className="reviewHero" role="status">
        <span className="reviewCheck" aria-hidden="true">✓</span>
        <div>
          <small>확인한 검사</small>
          <strong>{document.procedure_name}</strong>
          <p>안내문 {analysis.documents.length}개를 확인했어요.</p>
        </div>
      </div>
      <div className="reviewDocuments" aria-label="확인된 안내문">
        {analysis.procedures.map((procedure) => (
          <section key={procedure.group_id}>
            <h2>{procedure.procedure_name}</h2>
            {procedure.appointment_period !== "unknown" && (
              <p>검사 시간: {procedure.appointment_period === "morning" ? "오전" : "오후"}</p>
            )}
            {procedure.regimen_name && <p>장 청소약: {procedure.regimen_name}</p>}
            <ul>
              {analysis.documents
                .filter((item) => procedure.document_ids.includes(item.document_id))
                .map((item) => (
                  <li key={item.document_id}>
                    <b>{roleLabel(item.document_role)}</b>
                    <span>{item.source_file_name}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="reviewGrid">
        <label className="reviewField">
          <span>검사 또는 시술 이름</span>
          <input value={document.procedure_name} onChange={(event) => onChangeField("procedure_name", event.target.value)} />
        </label>
        <label className="reviewField"><span>병원</span><input value={document.hospital_name} placeholder="원문 확인 필요" onChange={(event) => onChangeField("hospital_name", event.target.value)} /></label>
        <label className="reviewField"><span>검사 날짜</span><input value={document.procedure_date} placeholder="원문 확인 필요" onChange={(event) => onChangeField("procedure_date", event.target.value)} /></label>
        <label className="reviewField"><span>예약 시간</span><input value={document.appointment_time} placeholder="원문 확인 필요" onChange={(event) => onChangeField("appointment_time", event.target.value)} /></label>
        <div className="reviewField"><span>안내문</span><strong>{document.page_count}쪽 · {reliability}</strong></div>
      </div>
      {analysis.warnings.length > 0 && <div className="warningBox"><b>원문을 다시 봐 주세요</b>{analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
      <button className="mainAction" type="button" onClick={onConfirm}>맞아요, 질문 시작하기</button>
    </section>
  );
}
