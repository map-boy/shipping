import Reveal from "./Reveal";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const faqs = Array.from({ length: 12 }, (_, i) => ({
  q: `faq.${i + 1}.q` as MsgKey,
  a: `faq.${i + 1}.a` as MsgKey,
}));
const col1 = faqs.slice(0, 6);
const col2 = faqs.slice(6);

export default function FAQ() {
  const { t } = useLang();
  return (
    <section id="help" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <Reveal>
        <div className="pb-20">
          <h2 className="text-3xl font-bold text-gray-900">{t("faq.title")}</h2>
        </div>
      </Reveal>
      <div className="md:flex md:space-x-12 space-y-8 md:space-y-0">
        {[col1, col2].map((col, c) => (
          <div key={c} className="w-full md:w-1/2 space-y-8">
            {col.map((faq, i) => (
              <Reveal key={faq.q} delayMs={i * 80}>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-gray-900">{t(faq.q)}</h4>
                  <p className="text-slate-600">{t(faq.a)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}