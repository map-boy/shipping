import { Link } from "react-router-dom";
import { SERVICE_OFFERS } from "../lib/serviceCatalog";

/**
 * Every service, described with its own pricing rule and its own Book button,
 * plus one general booking entry at the end for anyone who has not decided.
 */
export default function ServiceOffers() {
  return (
    <section id="services" className="max-w-5xl mx-auto px-4 py-14">
      <h2 className="text-3xl font-bold">What we move</h2>
      <p className="text-muted mt-2 max-w-2xl">
        Each service is priced by its own rule, shown up front. No account is needed to book.
      </p>

      <div className="mt-8 space-y-4">
        {SERVICE_OFFERS.map((offer) => (
          <article
            key={offer.slug}
            className="border border-line rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-5"
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold">{offer.name}</h3>
              <p className="text-muted mt-1.5">{offer.summary}</p>

              <div className="mt-3 rounded-lg bg-surface px-4 py-3">
                <p className="eyebrow">How it is priced</p>
                <p className="text-sm font-medium mt-0.5">{offer.pricing}</p>
              </div>

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
              Book {offer.name.toLowerCase()}
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-ink text-white p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold">Not sure which you need?</h3>
          <p className="text-white/70 mt-1.5">
            Start a general booking and compare the price of every vehicle that can serve your
            route before you choose.
          </p>
        </div>
        <Link
          to="/book"
          className="shrink-0 w-full sm:w-auto bg-white text-ink rounded-lg px-6 py-3.5 text-base font-semibold text-center active:bg-line"
        >
          Book or order
        </Link>
      </div>
    </section>
  );
}
