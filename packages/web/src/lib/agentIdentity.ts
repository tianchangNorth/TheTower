const ACCENTS = ["arc", "solar", "void", "strand"] as const;
export type Accent = (typeof ACCENTS)[number];

/** 由 agentId 稳定派生身份色，用于消息气泡、状态条、mention。 */
export function agentAccent(agentId: string): Accent {
  let h = 0;
  for (const c of agentId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

const TEXT: Record<Accent, string> = {
  arc: "text-tower-accent-arc",
  solar: "text-tower-accent-solar",
  void: "text-tower-accent-void",
  strand: "text-tower-accent-strand",
};
const BORDER: Record<Accent, string> = {
  arc: "border-tower-accent-arc/40",
  solar: "border-tower-accent-solar/40",
  void: "border-tower-accent-void/40",
  strand: "border-tower-accent-strand/40",
};
const BG: Record<Accent, string> = {
  arc: "bg-tower-accent-arc/10",
  solar: "bg-tower-accent-solar/10",
  void: "bg-tower-accent-void/10",
  strand: "bg-tower-accent-strand/10",
};
const SOLID: Record<Accent, string> = {
  arc: "bg-tower-accent-arc",
  solar: "bg-tower-accent-solar",
  void: "bg-tower-accent-void",
  strand: "bg-tower-accent-strand",
};

export function agentAccentClasses(agentId: string) {
  const a = agentAccent(agentId);
  return { text: TEXT[a], border: BORDER[a], bg: BG[a], solid: SOLID[a], accent: a };
}
