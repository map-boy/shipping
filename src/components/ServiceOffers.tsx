import { Link } from "react-router-dom";
import { SERVICE_OFFERS } from "../lib/serviceCatalog";
import { useLang } from "../i18n/context";

/**
 * Every service, described with its own pricing rule and its own Book button,
 * plus one general booking entry at the end for anyone who has not decided.
 */
export default function ServiceOffers() {
  const { t } = useLang();
  return (
    <section id="services" className="max-w-5xl mx-auto px-4 py-14">
      <h2 className="text-3xl font-bold">{t("offers.title")}</h2>
      <p className="text-muted mt-2 max-w-2xl">{t("offers.sub")}</p>

      <div className="mt-8 space-y-4">
        {SERVICE_OFFERS.map((offer) => (
          <article
            key={offer.slug}
            className="border border-line rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-5"
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold">{offer.name}</h3>
              <p className="text-muted mt-1.5">{offer.summary}</p>

              <ul className="mt-3 space-y-1.5">
                {offer.detail.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink mt-1.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to={offer.bookHref}
              className="shrink-0 w-full sm:w-auto bg-ink text-white rounded-lg px-6 py-3.5 text-base font-semibold text-center active:bg-ink2"
            >
              {t("offers.book", { name: offer.name.toLowerCase() })}
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-ink text-white p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold">{t("offers.unsure_title")}</h3>
          <p className="text-white/70 mt-1.5">{t("offers.unsure_text")}</p>
        </div>
        <Link
          to="/book"
          className="shrink-0 w-full sm:w-auto bg-white text-ink rounded-lg px-6 py-3.5 text-base font-semibold text-center active:bg-line"
        >
          {t("offers.cta")}
        </Link>
      </div>
    </section>
  );
}