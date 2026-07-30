import type {
  ExtractedInstruction,
  ParsedBlock,
  ParsedCoordinate,
  ParsedPage,
} from "./types";
import { fetchUpstage } from "./upstage-fetch";

const UPSTAGE_BASE_URL = "https://api.upstage.ai/v1";
const EASY_TEXT_CACHE = new Map<string, string>();

function getApiKey(): string {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  return apiKey;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function asContentString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#_*`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCoordinates(value: unknown): ParsedCoordinate[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const coordinates = value
    .map((point) => asRecord(point))
    .filter((point): point is Record<string, unknown> => Boolean(point))
    .map((point) => ({
      x: typeof point.x === "number" ? point.x : Number.NaN,
      y: typeof point.y === "number" ? point.y : Number.NaN,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return coordinates.length ? coordinates : undefined;
}

function parseBlock(value: unknown, index: number): { page: number; block: ParsedBlock } | null {
  const item = asRecord(value);
  if (!item) return null;
  const page = typeof item.page === "number" && item.page > 0 ? Math.floor(item.page) : 1;
  const content = asRecord(item.content);
  const markdown = asContentString(content?.markdown)
    || asContentString(item.markdown);
  const text = asContentString(content?.text)
    || asContentString(item.text)
    || stripMarkup(markdown || asContentString(content?.html) || asContentString(item.html));
  const html = asContentString(content?.html) || asContentString(item.html);
  const effectiveMarkdown = markdown || text || stripMarkup(html);
  if (!effectiveMarkdown && !text) return null;

  return {
    page,
    block: {
      blockId: String(item.id ?? index),
      category: asContentString(item.category) || "unknown",
      text: text || stripMarkup(effectiveMarkdown),
      markdown: effectiveMarkdown,
      coordinates: parseCoordinates(item.coordinates),
    },
  };
}

function fullDocumentContent(data: Record<string, unknown>): string {
  const content = asRecord(data.content);
  return [
    content?.markdown,
    content?.text,
    content?.html,
    data.markdown,
    data.text,
    data.html,
    typeof data.content === "string" ? data.content : "",
  ].map(asContentString).find(Boolean) || "";
}

function buildParsedPages(data: Record<string, unknown>): ParsedPage[] {
  const elements = Array.isArray(data.elements) ? data.elements : [];
  const reportedPageNumbers = elements
    .map((element) => asRecord(element)?.page)
    .filter((page): page is number => typeof page === "number" && page > 0)
    .map((page) => Math.floor(page));
  const grouped = new Map<number, ParsedBlock[]>();

  elements.forEach((element, index) => {
    const parsed = parseBlock(element, index);
    if (!parsed) return;
    const current = grouped.get(parsed.page) || [];
    current.push(parsed.block);
    grouped.set(parsed.page, current);
  });

  const pageNumbers = [...new Set([...reportedPageNumbers, ...grouped.keys()])].sort((a, b) => a - b);
  const fullContent = fullDocumentContent(data);
  if (!pageNumbers.length) {
    if (!fullContent) throw new Error("안내문에서 읽을 수 있는 내용을 찾지 못했습니다.");
    return [{
      pageNumber: 1,
      text: stripMarkup(fullContent),
      markdown: fullContent,
      blocks: [{
        blockId: "document-content",
        category: "document",
        text: stripMarkup(fullContent),
        markdown: fullContent,
      }],
    }];
  }

  return pageNumbers.map((sourcePageNumber, index) => {
    const blocks = grouped.get(sourcePageNumber) || [];
    let markdown = blocks.map((block) => block.markdown).filter(Boolean).join("\n");
    let text = blocks.map((block) => block.text).filter(Boolean).join("\n");
    if (!markdown && index === 0 && fullContent) markdown = fullContent;
    if (!text && markdown) text = stripMarkup(markdown);
    return {
      // API의 물리 페이지 순서를 1부터 연속된 내부 페이지 번호로 정규화한다.
      pageNumber: index + 1,
      text,
      markdown,
      blocks,
    };
  });
}

export async function parseDocument(file: File): Promise<ParsedPage[]> {
  const formData = new FormData();
  formData.append("document", file, file.name);
  formData.append("model", "document-parse-260128");
  formData.append("ocr", "auto");
  formData.append("output_formats", '["markdown"]');

  const response = await fetchUpstage(`${UPSTAGE_BASE_URL}/document-digitization`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: formData,
  }, { timeoutMs: 30_000, retries: 1, operation: "document_parse" });

  const data = await response.json() as Record<string, unknown>;
  return buildParsedPages(data);
}

function cacheKey(instruction: ExtractedInstruction): string {
  return instruction.source_text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function numericTokens(text: string): string[] {
  return text.match(/\d+(?::\d+)?(?:\.\d+)?/g) || [];
}

function preservesProtectedValues(source: string, easyText: string): boolean {
  return numericTokens(source).every((token) => easyText.includes(token));
}

export async function simplifySelectedInstructions(
  instructions: ExtractedInstruction[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing = instructions.filter((instruction) => {
    const cached = EASY_TEXT_CACHE.get(cacheKey(instruction));
    if (cached) result[instruction.instruction_id] = cached;
    return !cached;
  });
  if (!missing.length) return result;

  const model = process.env.UPSTAGE_CHAT_MODEL || "solar-pro3";
  const response = await fetchUpstage(`${UPSTAGE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "병원 안내문 원문을 고령자가 이해할 수 있는 쉬운 한 문장으로 바꾼다.",
            "의료 지시를 추가하거나 삭제하지 않는다.",
            "원문에 있는 숫자, 날짜, 시각, 용량, 약 이름은 한 글자도 바꾸지 않는다.",
            "약을 임의로 끊거나 계속 먹으라고 하지 않는다.",
            "한 문장에는 행동 하나만 쓴다.",
            "JSON 이외의 내용은 출력하지 않는다.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            items: missing.map((instruction) => ({
              id: instruction.instruction_id,
              source_text: instruction.source_text,
              protected_values: numericTokens(instruction.source_text),
            })),
            output: { items: [{ id: "원본 ID", easy_text: "쉬운 한 문장" }] },
          }),
        },
      ],
      temperature: 0,
      reasoning_effort: "low",
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  }, { timeoutMs: 30_000, retries: 0, operation: "solar_easy_text" });

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("쉬운말 변환 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { items?: Array<{ id?: unknown; easy_text?: unknown }> };
  for (const item of parsed.items || []) {
    if (typeof item.id !== "string" || typeof item.easy_text !== "string") continue;
    const source = missing.find((instruction) => instruction.instruction_id === item.id);
    if (!source || !preservesProtectedValues(source.source_text, item.easy_text)) continue;
    const easyText = item.easy_text.trim();
    result[source.instruction_id] = easyText;
    EASY_TEXT_CACHE.set(cacheKey(source), easyText);
  }
  return result;
}
