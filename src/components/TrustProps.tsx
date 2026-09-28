import Reveal from "./Reveal";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const items: { title: MsgKey; desc: MsgKey; icon: string }[] = [
  { title: "trust.1.title", desc: "trust.1.desc", icon: "\u26a1" },
  { title: "trust.2.title", desc: "trust.2.desc", icon: "\ud83d\udee1\ufe0f" },
  { title: "trust.3.title", desc: "trust.3.desc", icon: "\ud83d\udcb0" },
];

export default function TrustProps() {
  const { t } = useLang();
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <Reveal>
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">{t("trust.title")}</h2>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-8">
        {items.map((item, i) => (
          <Reveal key={item.title} delayMs={i * 120}>
            <div className="text-center px-4 py-6 rounded-2xl transition hover:shadow-lg hover:-translate-y-1 duration-300">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="font-semibold text-lg text-gray-900">{t(item.title)}</h3>
              <p className="mt-2 text-gray-600 text-sm">{t(item.desc)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}