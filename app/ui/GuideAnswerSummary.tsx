"use client";

import type { PersonalizationQuestion } from "@/app/lib/types";

interface Props {
  questions: PersonalizationQuestion[];
  answers: Record<string, string>;
  onEdit: (questionId: string) => void;
}

export default function GuideAnswerSummary({ questions, answers, onEdit }: Props) {
  if (!questions.length) return null;

  const unanswered = questions.filter((question) => !answers[question.question_id]);

  if (unanswered.length > 0) {
    return (
      <section className="guideAnswerSummary pending interactiveOnly" aria-live="polite">
        <p>{unanswered.length}가지만 더 알려 주세요.</p>
        <span>아래 질문에 답하면 내 안내서가 완성돼요.</span>
      </section>
    );
  }

  return (
    <section className="guideAnswerSummary complete interactiveOnly" aria-labelledby="answer-summary-heading">
      <p id="answer-summary-heading">나만의 안내서가 완성됐어요</p>
      <ul>
        {questions.map((question) => {
          const value = answers[question.question_id];
          const option = question.options.find((item) => item.value === value);
          return (
            <li key={question.question_id}>
              <span>{question.question.replace(/[?？]/g, "")}: {option?.label || "잘 모르겠어요"}</span>
              <button type="button" onClick={() => onEdit(question.question_id)}>답변 수정</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
