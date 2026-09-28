import { Link } from "react-router-dom";
import heroImg from "../assets/Kigali.jpg";



export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-heroFrom to-heroTo pt-12 pb-16 rounded-bl-[100px] overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 w-64 h-64 rounded-full bg-rwYellow/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-rwGreen/10 blur-3xl" />
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center relative">
        <div className="animate-fadeInUp">
          <span className="inline-block bg-white/10 text-rwYellow text-xs font-semibold tracking-wide px-3 py-1 rounded-full mb-4">
            Made for Rwanda &middot; Kigali &amp; beyond
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Move people. <br /> <span className="text-cta">Move freight.</span>
          </h1>
          <p className="mt-4 text-lg text-blue-200">
            Book a ride for yourself or send a package across Kigali &mdash; live tracking, fair fares, pay by Mobile Money or cash.
            <br />
            Trusted by riders and passengers across Rwanda.
          </p>
          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <Link
              to="/ride"
              className="block bg-cta hover:bg-ctaHover text-white rounded-2xl p-5 shadow-lg transition transform hover:-translate-y-1"
            >
              <span className="block text-lg font-bold">Book Executive Passenger Transport</span>
              <span className="block text-sm text-white/80 mt-1">Rides, airport transfers and charters</span>
            </Link>
            <Link
              to="/book?vehicle=truck"
              className="block bg-white hover:bg-gray-50 text-gray-900 rounded-2xl p-5 shadow-lg transition transform hover:-translate-y-1"
            >
              <span className="block text-lg font-bold">Request Haulage &amp; Freight Quote</span>
              <span className="block text-sm text-gray-600 mt-1">Trucks and heavy goods, priced up front</span>
            </Link>
          </div>
          <div className="mt-4 text-sm text-blue-200">
            4.8/5 &middot; trusted by thousands of riders in Kigali
          </div>
        </div>
        <div id="heroImageContainer" className="hidden md:block animate-fadeInUp" style={{ animationDelay: "150ms" }}>
          <img src={heroImg} alt="Taxi driver in Kigali, Rwanda" className="w-full h-auto rounded-2xl shadow-2xl" loading="eager" fetchPriority="high" decoding="async" width="800" height="600" />
        </div>
      </div>
    </section>
  );
}

