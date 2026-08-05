import { Link } from "react-router-dom";
import heroImg from "../assets/Kigali.jpg";

const categories = [
  "Passenger Ride", "Small Package", "Furniture & Boxes", "Market Goods",
  "Office Delivery", "Airport Transfer", "Moving Home", "Other Goods",
];

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
            Get a taxi <br /> <span className="text-cta">in minutes</span>
          </h1>
          <p className="mt-4 text-lg text-blue-200">
            Book a ride for yourself or send a package across Kigali &mdash; live tracking, fair fares, pay by Mobile Money or cash.
            <br />
            Trusted by riders and passengers across Rwanda.
          </p>
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-5 space-y-4 transition-transform hover:-translate-y-1 hover:shadow-2xl duration-300">
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 h-[50px]" defaultValue="">
              <option value="" disabled>What do you need moved?</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Pickup location in Kigali"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 h-[50px]"
            />
            <Link
              to="/ride"
              className="block w-full text-center bg-cta hover:bg-ctaHover text-white font-semibold py-3 rounded-lg transition transform hover:scale-[1.02]"
            >
              Book a Taxi Now
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
