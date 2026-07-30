import type { ParsedPage } from "./types";

export function parsedPageText(page: ParsedPage): string {
  const preferred = page.markdown.trim() || page.text.trim();
  if (preferred) return preferred;
  return page.blocks
    .map((block) => block.markdown.trim() || block.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function serializeParsedPages(pages: ParsedPage[]): string {
  return pages
    .map((page) => `--- 안내문 ${page.pageNumber}쪽 ---\n${parsedPageText(page)}`)
    .join("\n\n");
}
