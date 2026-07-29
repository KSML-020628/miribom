import type { ExtractedInstruction } from "./types";
import { fetchUpstage } from "./upstage-fetch";

const UPSTAGE_BASE_URL = "https://api.upstage.ai/v1";
const EASY_TEXT_CACHE = new Map<string, string>();

function getApiKey(): string {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  return apiKey;
}

export async function parseDocument(file: File): Promise<string> {
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
  if (data.content && typeof data.content === "object") {
    const content = data.content as Record<string, unknown>;
    const structured = [content.markdown, content.html, content.text]
      .find((value) => typeof value === "string" && value.trim());
    if (typeof structured === "string") return structured.trim();
  }
  const direct = [data.content, data.markdown, data.html, data.text]
    .find((value) => typeof value === "string" && value.trim());
  if (typeof direct === "string") return direct.trim();
  if (Array.isArray(data.elements)) {
    const content = data.elements.map((element) => {
      if (!element || typeof element !== "object") return "";
      const item = element as Record<string, unknown>;
      if (item.content && typeof item.content === "object") {
        const nested = item.content as Record<string, unknown>;
        return [nested.markdown, nested.html, nested.text].find((value) => typeof value === "string") || "";
      }
      return [item.markdown, item.html, item.content, item.text].find((value) => typeof value === "string") || "";
    }).filter(Boolean).join("\n");
    if (content.trim()) return content.trim();
  }
  throw new Error("안내문에서 읽을 수 있는 내용을 찾지 못했습니다.");
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
