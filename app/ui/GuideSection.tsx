import type { SectionItem } from "@/app/lib/guide-visibility";
import GuideInstructionBlock from "./GuideInstructionBlock";
import InlineGuideQuestion from "./InlineGuideQuestion";

interface Props {
  id: string;
  title: string;
  items: SectionItem[];
  onAnswer: (questionId: string, value: string) => void;
  onSpeak: (text: string) => void;
}

export default function GuideSection({ id, title, items, onAnswer, onSpeak }: Props) {
  return (
    <section className="guideSection" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className="guideInstructionList">
        {items.map((item) => item.kind === "page"
          ? <GuideInstructionBlock key={`page-${item.page.page_number}`} page={item.page} />
          : (
            <InlineGuideQuestion
              key={`question-${item.question.question_id}`}
              question={item.question}
              onAnswer={onAnswer}
              onSpeak={onSpeak}
            />
          ))}
      </div>
    </section>
  );
}
