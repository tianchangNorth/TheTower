// SSE 直连 API origin，绕过 Next dev 代理（dev 代理会破坏浏览器 EventSource 的实时分块）。
// REST 仍走同源代理（/api/* → next.config rewrites），仅 SSE 长连接直连。
// 生产环境若同源代理可正常承载 SSE，设 NEXT_PUBLIC_SSE_ORIGIN="" 走同源。
export function getSseUrl(): string {
  const origin = process.env.NEXT_PUBLIC_SSE_ORIGIN ?? "http://127.0.0.1:3001";
  if (!origin) return "/api/events";
  return `${origin.replace(/\/+$/, "")}/api/events`;
}
