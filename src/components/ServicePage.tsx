import { useParams, Link } from "react-router-dom";
import { services } from "../lib/services";

export default function ServicePage() {
  const { slug } = useParams<{ slug: string }>();
  const service = services.find((s) => s.slug === slug);

  if (!service) {
    return (
      <section className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Service not found</h1>
        <Link to="/" className="text-cta hover:underline">Back to home</Link>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <img
            src={service.img}
            alt={service.name}
            className="w-full h-64 md:h-96 object-cover rounded-2xl"
            loading="eager"
            decoding="async"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{service.name}</h1>
          <p className="text-lg text-slate-600 mb-6">{service.description}</p>
          <Link
            to="/ride"
            className="inline-block bg-cta hover:bg-ctaHover text-white font-semibold px-6 py-3 rounded-full transition"
          >
            Get Quotes Now
          </Link>
        </div>
      </div>
    </section>
  );
}
