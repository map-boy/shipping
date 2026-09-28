import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LangContext, type LangContextValue } from "./context";
import { LANGS, LOCALE, dictionaries, type Lang } from "./messages";
import { active } from "./active";

const STORAGE_KEY = "tiktak.lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    /* storage blocked: fall through to browser language */
  }
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return nav === "rw" || nav === "sw" ? nav : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
    active.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangContextValue>(() => {
    const dict = dictionaries[lang];
    return {
      lang,
      setLang,
      locale: LOCALE[lang],
      t: (key, vars) => {
        const s = dict[key];
        return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
      },
    };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}