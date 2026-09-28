import Reveal from "./Reveal";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const deliveries: { item: MsgKey; from: string; to: string; price: string }[] = [
  { item: "recent.d1", from: "Kimironko, Kigali", to: "Nyabugogo, Kigali", price: "2,400 RWF" },
  { item: "recent.d2", from: "Kacyiru, Kigali", to: "Remera, Kigali", price: "1,800 RWF" },
  { item: "recent.d3", from: "Kigali International Airport", to: "Kimihurura, Kigali", price: "6,500 RWF" },
  { item: "recent.d4", from: "Kimisagara Market", to: "Gikondo, Kigali", price: "3,200 RWF" },
];

const trustPoints: MsgKey[] = ["recent.tp1", "recent.tp2", "recent.tp3", "recent.tp4", "recent.tp5"];

export default function RecentDeliveries() {
  const { t } = useLang();
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-8 pb-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <Reveal className="md:order-1 md:max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("recent.title")}</h2>
            <p className="text-lg text-slate-500 mb-6">{t("recent.text")}</p>
            <ul className="flex flex-col text-slate-600 space-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xs mr-3">&#10003;</span>
                  {t(point)}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="flex gap-4 overflow-x-auto max-w-full md:max-w-md pb-4">
            {deliveries.map((d, i) => (
              <Reveal key={d.item} delayMs={i * 100}>
                <div className="flex flex-col bg-white rounded-lg overflow-hidden shadow-lg min-w-[260px] transition hover:-translate-y-1 hover:shadow-xl duration-300">
                  <div className="w-full h-[160px] bg-gray-200" />
                  <div className="px-6 pt-4">
                    <div className="font-bold text-xl mb-2">{t(d.item)}</div>
                    <div className="text-gray-700 flex flex-col text-sm">
                      <div>{d.from}</div>
                      <div className="w-px h-6 bg-gray-300 ml-1 my-1" />
                      <div>{d.to}</div>
                    </div>
                  </div>
                  <div className="flex justify-end items-center mt-2">
                    <div className="px-6 py-2 bg-cta text-white font-bold rounded-tl-lg">
                      {d.price}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}