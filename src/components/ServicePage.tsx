import { useParams, Link } from "react-router-dom";
import { services } from "../lib/services";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

export default function ServicePage() {
  const { t } = useLang();
  const { slug } = useParams<{ slug: string }>();
  const service = services.find((s) => s.slug === slug);

  if (!service) {
    return (
      <section className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("service.notfound")}</h1>
        <Link to="/" className="text-cta hover:underline">{t("service.back")}</Link>
      </section>
    );
  }

  const name = t(`svc.${service.slug}.name` as MsgKey);
  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <img
            src={service.img}
            alt={name}
            className="w-full h-64 md:h-96 object-cover rounded-2xl"
            loading="eager"
            decoding="async"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{name}</h1>
          <p className="text-lg text-slate-600 mb-6">{t(`svc.${service.slug}.desc` as MsgKey)}</p>
          <Link
            to="/ride"
            className="inline-block bg-cta hover:bg-ctaHover text-white font-semibold px-6 py-3 rounded-full transition"
          >
            {t("service.quotes")}
          </Link>
        </div>
      </div>
    </section>
  );
}