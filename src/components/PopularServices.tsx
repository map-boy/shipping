import { Link } from "react-router-dom";
import { services } from "../lib/services";

export default function PopularServices() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto border-2 border-slate-100 bg-gradient-to-t from-white rounded-tr-[100px] px-4 sm:px-6 py-8">
        <h2 className="text-center md:text-left text-2xl font-bold text-gray-900 py-8">
          Popular Services
        </h2>
        <div className="flex justify-center">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service, i) => (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className={`relative bg-gray-200 border border-gray-300 rounded-md overflow-hidden group h-[200px] w-[135px] sm:h-[298px] sm:w-[198px] ${i % 2 === 1 ? "mt-10 sm:mt-20" : ""}`}
              >
                <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 z-10 pl-2 pb-1 text-left text-white font-bold text-lg">
                  {service.name}
                </span>
                <div className="absolute inset-0 bg-[#1E293B] opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
