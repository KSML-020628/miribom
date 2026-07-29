"use client";

import { useState } from "react";

const FALLBACKS: Record<string, { symbol: string; label: string }> = {
  COLONOSCOPY: { symbol: "장", label: "대장 검사" },
  GASTROSCOPY: { symbol: "위", label: "위 검사" },
  GASTRECTOMY_HISTORY: { symbol: "위", label: "위 수술" },
  STOP_EATING: { symbol: "×", label: "먹지 않기" },
  NO_WATER: { symbol: "×", label: "물 마시지 않기" },
  EAT_PORRIDGE: { symbol: "죽", label: "죽 먹기" },
  TAKE_MEDICINE: { symbol: "약", label: "약 먹기" },
  ASK_DOCTOR: { symbol: "?", label: "의료진에게 묻기" },
  TAKE_BOWEL_PREP: { symbol: "약", label: "장을 비우는 약" },
  NO_DRIVING: { symbol: "×", label: "운전하지 않기" },
  COME_WITH_GUARDIAN: { symbol: "둘", label: "보호자와 함께" },
  HOSPITAL_ARRIVAL: { symbol: "병원", label: "병원에 오기" },
  CALL_HOSPITAL: { symbol: "☎", label: "병원에 전화하기" },
  CHECK_TEETH: { symbol: "이", label: "치아 확인" },
  CHECK_TIME: { symbol: "시", label: "시간 확인" },
  IMAGE_NOT_FOUND: { symbol: "안내", label: "안내 그림 준비 중" },
};

interface Props {
  tag: string;
  size?: "medium" | "large";
}

export default function PictureCard({ tag, size = "large" }: Props) {
  const [failed, setFailed] = useState(false);
  const fallback = FALLBACKS[tag] || FALLBACKS.IMAGE_NOT_FOUND;
  return (
    <figure className={`pictureCard ${size}`} aria-label={fallback.label}>
      {!failed && tag !== "IMAGE_NOT_FOUND" ? (
        <img src={`/pictograms/${tag}.png`} alt={fallback.label} onError={() => setFailed(true)} />
      ) : (
        <div className="picturePlaceholder" aria-hidden="true"><strong>{fallback.symbol}</strong><span>{fallback.label}</span></div>
      )}
    </figure>
  );
}
