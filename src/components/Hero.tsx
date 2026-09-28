import { Link } from "react-router-dom";
import heroImg from "../assets/Kigali.jpg";
import { useLang } from "../i18n/context";

export default function Hero() {
  const { t } = useLang();
  return (
    <section className="relative bg-gradient-to-r from-heroFrom to-heroTo pt-12 pb-16 rounded-bl-[100px] overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 w-64 h-64 rounded-full bg-rwYellow/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-rwGreen/10 blur-3xl" />
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center relative">
        <div className="animate-fadeInUp">
          <span className="inline-block bg-white/10 text-rwYellow text-xs font-semibold tracking-wide px-3 py-1 rounded-full mb-4">
            {t("hero.badge")}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            {t("hero.h1a")} <br /> <span className="text-cta">{t("hero.h1b")}</span>
          </h1>
          <p className="mt-4 text-lg text-blue-200">
            {t("hero.sub1")}
            <br />
            {t("hero.sub2")}
          </p>
          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <Link
              to="/ride"
              className="block bg-cta hover:bg-ctaHover text-white rounded-2xl p-5 shadow-lg transition transform hover:-translate-y-1"
            >
              <span className="block text-lg font-bold">{t("hero.cta1")}</span>
              <span className="block text-sm text-white/80 mt-1">{t("hero.cta1s")}</span>
            </Link>
            <Link
              to="/book?vehicle=truck"
              className="block bg-white hover:bg-gray-50 text-gray-900 rounded-2xl p-5 shadow-lg transition transform hover:-translate-y-1"
            >
              <span className="block text-lg font-bold">{t("hero.cta2")}</span>
              <span className="block text-sm text-gray-600 mt-1">{t("hero.cta2s")}</span>
            </Link>
          </div>
          <div className="mt-4 text-sm text-blue-200">{t("hero.rating")}</div>
        </div>
        <div id="heroImageContainer" className="hidden md:block animate-fadeInUp" style={{ animationDelay: "150ms" }}>
          <img src={heroImg} alt={t("hero.alt")} className="w-full h-auto rounded-2xl shadow-2xl" loading="eager" fetchPriority="high" decoding="async" width="800" height="600" />
        </div>
      </div>
    </section>
  );
}