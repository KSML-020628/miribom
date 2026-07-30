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

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

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
  const { document } = analysis;
  const primaryProcedure = analysis.procedures[0];
  const period = primaryProcedure?.appointment_period || "unknown";
  const exactTime = /^\d{2}:\d{2}$/.test(document.appointment_time)
    ? document.appointment_time
    : "";
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
        <div className="reviewSummaryControl">
          <span>시간</span>
          <fieldset className="inlineTimeChoices">
            <legend className="srOnly">검사 시간 바로 선택</legend>
            <button
              type="button"
              aria-pressed={period === "morning" && !exactTime}
              onClick={() => onChangeAppointment("morning")}
            >
              오전
            </button>
            <button
              type="button"
              aria-pressed={period === "afternoon" && !exactTime}
              onClick={() => onChangeAppointment("afternoon")}
            >
              오후
            </button>
            <button
              type="button"
              aria-pressed={period === "unknown" && !exactTime}
              onClick={() => onChangeAppointment("unknown")}
            >
              잘 모르겠어요
            </button>
            <div className="inlineTimeInput">
              <span>정확한 시간 (24시간)</span>
              <div className="timeSelect">
                <select
                  aria-label="검사 시간 - 시"
                  value={exactTime ? exactTime.split(":")[0] : ""}
                  onChange={(event) => {
                    const hour = event.target.value;
                    const minute = exactTime ? exactTime.split(":")[1] : "00";
                    const next = `${hour}:${minute}`;
                    onChangeAppointment(Number(hour) < 12 ? "morning" : "afternoon", next);
                  }}
                >
                  <option value="" disabled>시</option>
                  {HOURS.map((hour) => <option key={hour} value={hour}>{Number(hour)}시</option>)}
                </select>
                <span aria-hidden="true">:</span>
                <select
                  aria-label="검사 시간 - 분"
                  value={exactTime ? exactTime.split(":")[1] : ""}
                  onChange={(event) => {
                    const minute = event.target.value;
                    const hour = exactTime ? exactTime.split(":")[0] : "00";
                    const next = `${hour}:${minute}`;
                    onChangeAppointment(Number(hour) < 12 ? "morning" : "afternoon", next);
                  }}
                >
                  <option value="" disabled>분</option>
                  {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}분</option>)}
                </select>
              </div>
            </div>
          </fieldset>
        </div>
        {regimen && <p><span>장 청소약</span><strong>{regimen}</strong></p>}
        <label className="reviewSummaryControl reviewDateControl">
          <span>검사 날짜</span>
          <span className="reviewDatePicker">
            <strong>{koreanDate(document.procedure_date)}</strong>
            <input
              type="date"
              aria-label="검사 날짜 바로 선택"
              value={dateInputValue(document.procedure_date)}
              onChange={(event) => onChangeField("procedure_date", event.target.value)}
            />
          </span>
        </label>
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
