import type { GuidePage } from "@/app/lib/types";
import GuideInstructionBlock from "./GuideInstructionBlock";

interface Props {
  id: string;
  title: string;
  pages: GuidePage[];
}

export default function GuideSection({ id, title, pages }: Props) {
  return (
    <section className="guideSection" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className="guideInstructionList">
        {pages.map((page) => <GuideInstructionBlock key={page.page_number} page={page} />)}
      </div>
    </section>
  );
}
