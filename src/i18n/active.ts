import { dictionaries, type Lang, type MsgKey } from "./messages";

/** Current language for code that runs outside React (lib/*). Set by LangProvider. */
export const active: { lang: Lang } = { lang: "en" };

export function tr(key: MsgKey, vars?: Record<string, string | number>): string {
  const s = dictionaries[active.lang][key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}