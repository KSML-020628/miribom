"use client";

import type { PersonalizationQuestion } from "@/app/lib/types";

interface Props {
  question: PersonalizationQuestion;
  onAnswer: (questionId: string, value: string) => void;
}

// "네"/"아니요"만 색으로 구분한다. 개수·시간대 같은 선택지는 색 의미가 없으므로 중립으로 둔다.
function optionTone(value: string): "positive" | "negative" | "neutral" {
  if (value === "yes") return "positive";
  if (value === "no") return "negative";
  return "neutral";
}

export default function InlineGuideQuestion({ question, onAnswer }: Props) {
  return (
    <fieldset className="guideInlineQuestion personalizeQuestion" aria-label="확인이 필요한 질문">
      <legend>{question.question}</legend>
      {question.helper_text && <p>{question.helper_text}</p>}
      <div className="personalizeChoices">
        {question.options.map((option) => (
          <button
            type="button"
            key={option.value}
            data-tone={optionTone(option.value)}
            onClick={() => onAnswer(question.question_id, option.value)}
          >
            <span aria-hidden="true">{option.symbol}</span>
            <b>{option.label}</b>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
