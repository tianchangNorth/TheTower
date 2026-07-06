/**
 * 首页传说式 flavor 文案常量（中英）。
 * layout 已设 lang=zh-CN，默认走中文列；英文列留待 i18n 接入。
 * 只接入副标题位 / 面板 subtitle / 就绪指示 / 空状态，不替换功能文案。
 */
export type FlavorKey =
  | "heroLine"
  | "recentThreadsSubtitle"
  | "agentsSubtitle"
  | "quickLinksTitle"
  | "readyIdle"
  | "readyRunning"
  | "readyError"
  | "threadsEmpty"
  | "agentsEmpty";

export interface FlavorEntry {
  zh: string;
  en: string;
}

export const HOME_FLAVOR: Record<FlavorKey, FlavorEntry> = {
  heroLine: {
    zh: "静候指令，守护者。高塔灯火长明。",
    en: "Stand by, Guardian. The Tower hums with quiet light.",
  },
  recentThreadsSubtitle: { zh: "来自前线的讯息", en: "Transmissions from the field" },
  agentsSubtitle: { zh: "守夜者名册", en: "Roster of the steadfast" },
  quickLinksTitle: { zh: "星图导航", en: "Plot your course" },
  readyIdle: { zh: "系统就绪", en: "SYSTEM NOMINAL" },
  readyRunning: { zh: "待命", en: "AWAITING ORDERS" },
  readyError: { zh: "链路中断", en: "LINK LOST" },
  threadsEmpty: { zh: "炉火未燃。", en: "The fire has not yet been lit." },
  agentsEmpty: { zh: "无人守夜。", en: "No guardians stand watch." },
};

const LANG: "zh" | "en" = "zh";

/** 取当前语言的 flavor 文案。 */
export function flavor(key: FlavorKey): string {
  return HOME_FLAVOR[key][LANG];
}
