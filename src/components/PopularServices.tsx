import { Link } from "react-router-dom";
import { services } from "../lib/services";
import Reveal from "./Reveal";

export default function PopularServices() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto border-2 border-slate-100 bg-gradient-to-t from-white rounded-tr-[100px] px-4 sm:px-6 py-8">
        <Reveal>
          <h2 className="text-center md:text-left text-2xl font-bold text-gray-900 py-8">
            Popular Services in Kigali
          </h2>
        </Reveal>
        <div className="flex justify-center">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service, i) => (
              <Reveal key={service.slug} delayMs={(i % 4) * 100}>
                <Link
                  to={`/services/${service.slug}`}
                  className={`relative bg-gray-200 border border-gray-300 rounded-md overflow-hidden group h-[200px] w-[135px] sm:h-[298px] sm:w-[198px] block transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl ${i % 2 === 1 ? "mt-10 sm:mt-20" : ""}`}
                >
                  <img src={service.img} alt={service.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" decoding="async" width="198" height="298" />
                  <span className="absolute bottom-0 left-0 z-10 pl-2 pb-1 text-left text-white font-bold text-lg">
                    {service.name}
                  </span>
                  <div className="absolute inset-0 bg-[#1E293B] opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
