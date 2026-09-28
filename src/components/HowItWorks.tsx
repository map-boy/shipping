import { Link } from "react-router-dom";
import Reveal from "./Reveal";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const steps: { number: string; key: MsgKey }[] = [
  { number: "1", key: "how.1" },
  { number: "2", key: "how.2" },
  { number: "3", key: "how.3" },
];

export default function HowItWorks() {
  const { t } = useLang();
  return (
    <section id="how" className="max-w-7xl mx-auto px-4 lg:px-0 mt-20">
      <div className="py-12 rounded-tr-[100px] bg-slate-800">
        <div className="flex flex-col xl:flex-row items-center gap-2 px-4">
          <div className="flex flex-col items-center w-full">
            <Reveal>
              <h2 className="text-3xl font-bold text-white mb-12">{t("how.title")}</h2>
            </Reveal>
            <div className="lg:pl-[88px] w-full max-w-md">
              {steps.map((step, i) => (
                <Reveal key={step.number} delayMs={i * 120}>
                  <div className="flex items-center mb-8 last:mb-0 group">
                    <div className="w-5 h-5 min-w-[1.25rem] bg-white text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 transition-transform group-hover:scale-125">
                      {step.number}
                    </div>
                    <div className="text-lg text-left text-slate-400">{t(step.key)}</div>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="my-8">
              <Link to="/ride" className="inline-flex items-center text-blue-50 bg-blue-500 hover:bg-blue-600 font-semibold px-5 py-2.5 rounded-full transition shadow-sm hover:shadow-lg hover:scale-105">
                {t("how.cta")}
                <span className="ml-2">-&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}