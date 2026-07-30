"use client";

import { useState } from "react";
import type { PersonalizationQuestion } from "@/app/lib/types";

interface Props {
  questions: PersonalizationQuestion[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onSpeak: (text: string) => void;
}

export default function PersonalizePanel({ questions, answers, onAnswer, onSpeak }: Props) {
  const [open, setOpen] = useState(() => questions.some((question) => !answers[question.question_id]));
  if (!questions.length) return null;

  const answeredCount = questions.filter((question) => answers[question.question_id]).length;

  return (
    <section className="personalizePanel interactiveOnly" aria-labelledby="personalize-heading">
      <div className="personalizePanelHeader">
        <div>
          <p>내 답변에 맞춘 안내예요</p>
          <h2 id="personalize-heading">맞춤 답변 바꾸기</h2>
          <span aria-live="polite">{questions.length}개 중 {answeredCount}개를 골랐어요.</span>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="personalize-questions"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "닫기" : "답변 보기"}
        </button>
      </div>

      {open && (
        <div id="personalize-questions" className="personalizeQuestions">
          <p className="personalizeHelp">
            답을 바꾸면 아래 안내와 저장할 PDF가 바로 달라져요.
          </p>
          {questions.map((question) => {
            const selected = answers[question.question_id];
            return (
              <fieldset key={question.question_id} className="personalizeQuestion">
                <legend>{question.question}</legend>
                {question.helper_text && <p>{question.helper_text}</p>}
                <button
                  type="button"
                  className="personalizeListen"
                  aria-label={`${question.question} 읽기`}
                  onClick={() => onSpeak(
                    [question.question, question.helper_text, ...question.options.map((option) => option.label)]
                      .filter(Boolean)
                      .join(". "),
                  )}
                >
                  <span aria-hidden="true">🔊</span> 질문 듣기
                </button>
                <div className="personalizeChoices">
                  {question.options.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={selected === option.value ? "selected" : ""}
                      aria-pressed={selected === option.value}
                      onClick={() => onAnswer(question.question_id, option.value)}
                    >
                      <span aria-hidden="true">{option.symbol}</span>
                      <b>{option.label}</b>
                    </button>
                  ))}
                </div>
                {!selected && (
                  <p className="personalizeUnanswered" role="status">
                    아직 안 골랐어요. 답을 고르면 관련 안내가 바로 나타나요.
                  </p>
                )}
                {selected && selected !== "unknown" && (
                  <p className="personalizeFeedback" role="status">
                    선택한 답에 맞게 아래 안내를 바꿨어요.
                  </p>
                )}
                {selected === "unknown" && (
                  <p className="personalizeUnknown" role="status">
                    이 내용은 추측하지 않고 병원 확인 항목에 넣었어요.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
    </section>
  );
}
