export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function successResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export async function callbackToolResult(fn: () => Promise<string>): Promise<ToolResult> {
  try {
    return successResult(await fn());
  } catch (err) {
    if (err instanceof Error && "code" in err && typeof err.code === "string") {
      const codedError = err as Error & { code: string; details?: unknown };
      return errorResult(JSON.stringify({
        error: codedError.message,
        code: codedError.code,
        ...(typeof codedError.details === "object"
          ? { details: codedError.details }
          : {}),
      }));
    }
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
