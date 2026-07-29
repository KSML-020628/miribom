"use client";

import type { PersonalizationQuestion } from "@/app/lib/types";
import PictureCard from "./PictureCard";

interface Props {
  question: PersonalizationQuestion;
  index: number;
  total: number;
  selected?: string;
  onAnswer: (value: string) => void;
  onBack: () => void;
  onListen: () => void;
}

export default function QuestionStep({ question, index, total, selected, onAnswer, onBack, onListen }: Props) {
  return (
    <section className="questionScreen" aria-labelledby="question-heading">
      <div className="topTools">
        <button type="button" onClick={onBack}>← 이전</button>
        <button type="button" onClick={onListen}>▶ 질문 읽기</button>
      </div>
      <div className="questionProgress" aria-label={`${total}개 질문 중 ${index + 1}번째`}>
        <strong>{index + 1} / {total}</strong>
        <span><i style={{ width: `${((index + 1) / total) * 100}%` }} /></span>
      </div>
      <PictureCard tag={question.image_tag} />
      <div className="questionCopy">
        <h1 id="question-heading">{question.question}</h1>
        {question.helper_text && <p>{question.helper_text}</p>}
      </div>
      <div className="answerChoices">
        {question.options.map((option) => (
          <button
            className={`answerButton ${option.value} ${selected === option.value ? "selected" : ""}`}
            type="button"
            key={option.value}
            onClick={() => onAnswer(option.value)}
            aria-pressed={selected === option.value}
          >
            <span aria-hidden="true">{option.symbol}</span><b>{option.label}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
