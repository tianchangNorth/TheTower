const ACK_ONLY_RE =
  /^\s*(?:@[\w-]+\s*)*(?:收到|已收到|好的|好|ok|OK|完成|已完成|done|Done|thanks|Thanks|谢谢|明白)(?:[，。,.!\s]*(?:诗已完成|任务已完成|处理完成|完成了|收到))*[。,.!\s]*$/;

export function shouldRouteAgentText(content: string): boolean {
  return !ACK_ONLY_RE.test(content.trim());
}
