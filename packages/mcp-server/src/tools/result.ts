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
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
