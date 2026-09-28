import Reveal from "./Reveal";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const testimonials: { name: string; key: MsgKey }[] = [
  { name: "Eric N.", key: "testi.1" },
  { name: "Aline U.", key: "testi.2" },
  { name: "Jean Paul H.", key: "testi.3" },
  { name: "Diane K.", key: "testi.4" },
];

export default function Testimonials() {
  const { t } = useLang();
  return (
    <section className="bg-slate-50 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">{t("testi.title")}</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((item, i) => (
            <Reveal key={item.name} delayMs={i * 100}>
              <div className="bg-white rounded-2xl shadow-sm p-6 transition hover:shadow-lg hover:-translate-y-1 duration-300">
                <div className="w-14 h-14 rounded-full bg-gray-200 mb-4" />
                <p className="text-gray-700 text-sm italic">"{t(item.key)}"</p>
                <div className="mt-4 font-semibold text-gray-900 text-sm">{item.name}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}