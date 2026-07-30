"use client";

import { useState } from "react";
import type {
  AnalysisResult,
  AppointmentPeriod,
  DocumentSummary,
} from "@/app/lib/types";

interface Props {
  analysis: AnalysisResult;
  onChangeField: (
    field: keyof Pick<DocumentSummary, "procedure_name" | "hospital_name" | "procedure_date" | "appointment_time">,
    value: string,
  ) => void;
  onChangeAppointment: (period: AppointmentPeriod, exactTime?: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onListen: () => void;
  speaking: boolean;
}

function dateInputValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

function koreanDate(value: string): string {
  const normalized = dateInputValue(value);
  if (!normalized) return value || "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${normalized}T12:00:00+09:00`));
}

export default function ReviewStep({
  analysis,
  onChangeField,
  onChangeAppointment,
  onConfirm,
  onBack,
  onListen,
  speaking,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [exactTimeMode, setExactTimeMode] = useState(false);
  const { document } = analysis;
  const primaryProcedure = analysis.procedures[0];
  const period = primaryProcedure?.appointment_period || "unknown";
  const regimen = analysis.procedures.map((item) => item.regimen_name).find(Boolean);

  return (
    <section className="stepScreen reviewStep" aria-labelledby="review-heading">
      <div className="topTools">
        <button type="button" onClick={onBack}>← 다시 올리기</button>
        <button type="button" onClick={onListen} aria-label={speaking ? "읽기 멈추기" : "이 화면 듣기"}>
          <span aria-hidden="true">{speaking ? "⏹" : "🔊"}</span> {speaking ? "멈추기" : "듣기"}
        </button>
      </div>

      <div className="screenIntro centered">
        <h1 id="review-heading" data-screen-title tabIndex={-1}>이 안내문이 맞나요?</h1>
        <p>중요한 내용만 한 번 확인해 주세요.</p>
      </div>

      <div className="reviewSummary" role="status" aria-label="안내문 분석 결과">
        <p><span>안내문</span><strong>{analysis.documents.length}개 · {document.page_count}쪽</strong></p>
        <p><span>검사</span><strong>{document.procedure_name || "확인 필요"}</strong></p>
        <p><span>시간</span><strong>{period === "morning" ? "오전" : period === "afternoon" ? "오후" : document.appointment_time || "확인 필요"}</strong></p>
        {regimen && <p><span>장 청소약</span><strong>{regimen}</strong></p>}
        <p><span>검사 날짜</span><strong>{koreanDate(document.procedure_date)}</strong></p>
      </div>

      {editing && (
        <div className="reviewEditPanel">
          <h2>틀린 내용만 고쳐 주세요</h2>
          <label className="reviewField">
            <span>검사 이름</span>
            <input value={document.procedure_name} onChange={(event) => onChangeField("procedure_name", event.target.value)} />
          </label>
          <label className="reviewField">
            <span>병원</span>
            <input value={document.hospital_name} placeholder="확인 필요" onChange={(event) => onChangeField("hospital_name", event.target.value)} />
          </label>
          <label className="reviewField">
            <span>📅 검사 날짜 선택</span>
            <input
              type="date"
              value={dateInputValue(document.procedure_date)}
              onChange={(event) => onChangeField("procedure_date", event.target.value)}
            />
          </label>

          <fieldset className="timeChoices">
            <legend>검사는 언제예요?</legend>
            <button type="button" aria-pressed={period === "morning" && !exactTimeMode} onClick={() => { setExactTimeMode(false); onChangeAppointment("morning"); }}>오전</button>
            <button type="button" aria-pressed={period === "afternoon" && !exactTimeMode} onClick={() => { setExactTimeMode(false); onChangeAppointment("afternoon"); }}>오후</button>
            <button type="button" aria-pressed={period === "unknown" && !exactTimeMode} onClick={() => { setExactTimeMode(false); onChangeAppointment("unknown"); }}>잘 모르겠어요</button>
            <button type="button" aria-pressed={exactTimeMode} onClick={() => setExactTimeMode(true)}>정확한 시간</button>
          </fieldset>
          {exactTimeMode && (
            <label className="reviewField">
              <span>⏰ 시간 선택</span>
              <input
                type="time"
                value={/^\d{2}:\d{2}$/.test(document.appointment_time) ? document.appointment_time : ""}
                onChange={(event) => {
                  const hour = Number(event.target.value.split(":")[0]);
                  onChangeAppointment(hour < 12 ? "morning" : "afternoon", event.target.value);
                }}
              />
            </label>
          )}
          <button className="secondaryAction" type="button" onClick={() => setEditing(false)}>수정 완료</button>
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <details className="warningBox">
          <summary>확인이 필요한 내용이 있어요</summary>
          {analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </details>
      )}

      <div className="reviewActions">
        <button className="mainAction" type="button" onClick={onConfirm}>맞아요</button>
        <button className="secondaryAction" type="button" onClick={() => setEditing(true)}>수정할게요</button>
      </div>
    </section>
  );
}
