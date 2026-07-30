"use client";

import type { PersonalizationQuestion } from "@/app/lib/types";

interface Props {
  questions: PersonalizationQuestion[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onSpeak: (text: string) => void;
}

export default function PersonalizePanel({ questions, answers, onAnswer, onSpeak }: Props) {
  if (!questions.length) return null;
  const answeredCount = questions.filter((question) => answers[question.question_id]).length;

  return (
    <section className="personalizePanel" aria-labelledby="personalize-heading">
      <div className="personalizeIntro">
        <p className="eyebrow">나에게 맞추기</p>
        <h2 id="personalize-heading">나에게 해당하는 것을 골라 주세요</h2>
        <p className="personalizeHelp">고른 내용에 맞춰 아래 안내가 바뀌어요. 언제든 다시 고를 수 있어요.</p>
        <strong className="personalizeCount" aria-live="polite">{questions.length}개 중 {answeredCount}개 골랐어요</strong>
      </div>

      <ul className="personalizeList">
        {questions.map((question) => {
          const selected = answers[question.question_id];
          const answered = Boolean(selected);
          return (
            <li key={question.question_id} className={answered ? "personalizeCard answered" : "personalizeCard"}>
              <div className="personalizeQuestion">
                <h3>{question.question}</h3>
                {question.helper_text && <p>{question.helper_text}</p>}
                <button
                  type="button"
                  className="personalizeListen"
                  onClick={() => onSpeak(`${question.question}. ${question.helper_text}`)}
                >
                  ▶ 질문 읽기
                </button>
              </div>
              <div className="personalizeChoices">
                {question.options.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={selected === option.value ? "personalizeChoice selected" : "personalizeChoice"}
                    aria-pressed={selected === option.value}
                    onClick={() => onAnswer(question.question_id, option.value)}
                  >
                    <span aria-hidden="true">{option.symbol}</span>
                    <b>{option.label}</b>
                  </button>
                ))}
              </div>
              {!answered && <p className="personalizeUnanswered" role="status">아직 안 골랐어요</p>}
              {selected === "unknown" && (
                <p className="personalizeConfirm" role="status">잘 모르겠으면 병원에 확인해 주세요.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
