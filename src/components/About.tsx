import aboutImg from "../assets/about-photo.jpg";
import Reveal from "./Reveal";
import { useLang } from "../i18n/context";

export default function About() {
  const { t } = useLang();
  return (
    <section id="about" className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-12 md:pt-20 pb-12">
        <Reveal>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-8 text-center md:text-left">
            {t("about.title")}
          </h2>
        </Reveal>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Reveal className="w-full md:w-2/3">
            <p className="text-lg text-slate-500 text-justify">{t("about.text")}</p>
          </Reveal>
          <Reveal className="w-full md:w-1/3" delayMs={150}>
            <img src={aboutImg} alt={t("about.alt")} className="w-full h-auto rounded-xl shadow-lg transition hover:shadow-2xl duration-300" loading="lazy" decoding="async" width="600" height="450" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}