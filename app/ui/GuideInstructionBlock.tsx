"use client";

import type { GuidePage } from "@/app/lib/types";
import PictureCard from "./PictureCard";

const IMPORTANCE = {
  required: { symbol: "!", label: "꼭 지켜 주세요" },
  caution: { symbol: "△", label: "조심해 주세요" },
  ask_hospital: { symbol: "?", label: "병원에 물어보세요" },
  information: { symbol: "i", label: "알아두세요" },
};

function compactWhen(section: string, when?: string): string {
  if (!when) return "";
  const trimmed = when.trim();
  return trimmed.startsWith(section) ? trimmed.slice(section.length).trim() : trimmed;
}

export default function GuideInstructionBlock({ page }: { page: GuidePage }) {
  const importance = IMPORTANCE[page.importance];
  const displayWhen = compactWhen(page.section, page.when);

  return (
    <article className={`guideInstruction ${page.importance}`}>
      {displayWhen && <p className="instructionTime">{displayWhen}</p>}
      <div className="instructionContent">
        <PictureCard tag={page.image_tag} size="medium" />
        <div className="instructionCopy">
          <span className="importanceLabel">
            <b aria-hidden="true">{importance.symbol}</b>
            {importance.label}
          </span>
          <h3>{page.title}</h3>
          {page.body.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          {page.personalized && page.personalization_note && (
            <aside>맞춤 안내 · {page.personalization_note}</aside>
          )}
        </div>
      </div>
    </article>
  );
}
