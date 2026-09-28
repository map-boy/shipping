import { useLang } from "../i18n/context";
import { LANGS, LANG_LABEL, type Lang } from "../i18n/messages";

const SHORT: Record<Lang, string> = { rw: "RW", en: "EN", sw: "SW" };

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t("lang.label")} className="flex items-center gap-1">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LANG_LABEL[l]}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors ${
            lang === l ? "bg-white text-ink" : "text-slate-300 hover:text-white"
          }`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}