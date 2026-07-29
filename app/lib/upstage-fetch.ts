const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class UpstageApiError extends Error {
  status: number;
  requestId: string;
  retryable: boolean;

  constructor(message: string, status: number, requestId: string) {
    super(message);
    this.name = "UpstageApiError";
    this.status = status;
    this.requestId = requestId;
    this.retryable = RETRYABLE_STATUS.has(status);
  }
}

function parseErrorMessage(text: string, status: number): string {
  try {
    const payload = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return payload.error?.message || payload.message || `Upstage 요청 실패 (${status})`;
  } catch {
    return text.trim() || `Upstage 요청 실패 (${status})`;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 5000);
  return attempt === 0 ? 800 : 2200;
}

export async function fetchUpstage(
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; retries?: number; operation: string },
): Promise<Response> {
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
      if (response.ok) {
        console.info(JSON.stringify({
          event: "upstage_request",
          operation: options.operation,
          status: response.status,
          requestId,
          durationMs: Date.now() - startedAt,
          attempt: attempt + 1,
        }));
        return response;
      }

      const message = parseErrorMessage(await response.text(), response.status);
      const error = new UpstageApiError(message, response.status, requestId);
      console.error(JSON.stringify({
        event: "upstage_error",
        operation: options.operation,
        status: response.status,
        requestId,
        durationMs: Date.now() - startedAt,
        attempt: attempt + 1,
      }));
      if (!error.retryable || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      lastError = error;
    } catch (error) {
      lastError = error;
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if ((!isTimeout && !(error instanceof UpstageApiError)) || attempt === retries) throw error;
      if (error instanceof UpstageApiError && !error.retryable) throw error;
      if (isTimeout) await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 800 : 2200));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Upstage 요청을 처리하지 못했습니다.");
}
