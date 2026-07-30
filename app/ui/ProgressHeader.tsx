"use client";

import type { AppStep } from "@/app/lib/types";

const STEPS = [
  { key: "upload", label: "안내문 올리기" },
  { key: "guide", label: "쉬운 안내서" },
] as const;

const STEP_INDEX: Record<AppStep, number> = { upload: 0, guide: 1 };

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
