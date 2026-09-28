import { createContext, useContext } from "react";
import type { Lang, MsgKey } from "./messages";

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** BCP-47 tag for toLocaleString / toLocaleDateString */
  locale: string;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
}

export const LangContext = createContext<LangContextValue | null>(null);

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}