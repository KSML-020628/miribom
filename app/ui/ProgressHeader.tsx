"use client";

import type { AppStep } from "@/app/lib/types";

const STEPS = [
  { key: "UPLOAD_REVIEW", label: "사진 확인" },
  { key: "DOCUMENT_REVIEW", label: "내용 확인" },
  { key: "GUIDE", label: "쉬운 안내서" },
] as const;

const STEP_INDEX: Record<AppStep, number> = {
  HOME: 0,
  UPLOAD_REVIEW: 0,
  ANALYZING: 0,
  DOCUMENT_REVIEW: 1,
  GUIDE: 2,
};

interface Props {
  step: AppStep;
}

export default function ProgressHeader({ step }: Props) {
  const current = STEP_INDEX[step];
  return (
    <nav className="progressSteps" aria-label="만들기 진행 단계">
      {STEPS.map((item, index) => (
        <div className={`progressStep ${index === current ? "current" : ""} ${index < current ? "complete" : ""}`} key={item.key} aria-current={index === current ? "step" : undefined}>
          <span aria-hidden="true">{index < current ? "✓" : index + 1}</span>
          <b>{item.label}</b>
        </div>
      ))}
    </nav>
  );
}
