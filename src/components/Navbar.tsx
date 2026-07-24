import { useState } from "react";

const services = [
  "Furniture Delivery",
  "Motorbike Transport",
  "Car Transport",
  "Man And Van",
  "eBay Deliveries",
  "Fragile Item Transport",
  "Boat Transport",
  "Removals",
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="bg-black py-1 pl-8">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex gap-4 text-xs text-slate-300">
            <li><a href="/" className="text-white">Personal Use</a></li>
            <li><a href="#" className="hover:text-white">Business Use</a></li>
            <li><a href="#" className="hover:text-white">Transport Providers</a></li>
          </ul>
        </div>
      </div>

      <header className="absolute top-0 left-0 w-full z-30">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <span>YourBrand</span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-slate-100">
            <div className="relative group">
              <button className="flex items-center gap-1 hover:text-cta">
                Services
                <svg className="w-2.5 h-2.5 transform group-hover:rotate-180 transition-transform" viewBox="0 0 10 6" fill="none">
                  <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="absolute left-0 hidden group-hover:block bg-white rounded-lg shadow-md text-slate-700">
                <ul className="text-sm py-1">
                  {services.map((s) => (
                    <li key={s}>
                      <a href="#" className="block px-4 py-1 whitespace-nowrap hover:bg-gray-100 hover:text-cta rounded-lg">
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a href="#search" className="hover:text-cta">Search Deliveries</a>
            <a href="#how" className="hover:text-cta">How It Works</a>
            <a href="#help" className="hover:text-cta">Help</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden sm:inline text-sm text-slate-100 hover:text-cta">
              Log in
            </button>
            <button className="bg-cta hover:bg-ctaHover text-white text-sm font-semibold px-4 py-2 rounded-full transition">
              Get Quotes
            </button>
            <button
              className="lg:hidden text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden fixed top-16 left-0 w-full h-screen bg-white shadow-lg z-50 px-4 py-4">
            <ul className="text-gray-700 space-y-3">
              <li><a href="#" className="block hover:text-cta">Get Quotes</a></li>
              <li><a href="#" className="block hover:text-cta">Search Deliveries</a></li>
              <li><a href="#" className="block hover:text-cta">How It Works</a></li>
              <li><a href="#" className="block hover:text-cta">Help</a></li>
              {services.map((s) => (
                <li key={s}><a href="#" className="block hover:text-cta">{s}</a></li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </>
  );
}
