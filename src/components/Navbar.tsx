import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";

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

interface NavbarProps {
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export default function Navbar({ user, onLoginClick, onLogoutClick }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target as Node)
      ) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="bg-black py-1.5 px-4">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex gap-3 text-[11px] sm:text-xs text-slate-300 overflow-x-auto whitespace-nowrap">
            <li><a href="/" className="text-white">Personal Use</a></li>
            <li className="text-slate-500">Business Use (coming soon)</li>
            <li><Link to="/driver" className="hover:text-white">Transport Providers</Link></li>
          </ul>
        </div>
      </div>

      <header className="relative bg-slate-800 w-full z-30">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <Link to="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 64 64"><defs><linearGradient id="navlogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fea142"/><stop offset="100%" stop-color="#f98b1b"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="url(#navlogo)"/><path d="M32 14c-7.2 0-13 5.8-13 13 0 9.7 13 23 13 23s13-13.3 13-23c0-7.2-5.8-13-13-13z" fill="white"/><circle cx="32" cy="27" r="5.5" fill="#0f4c8b"/></svg>
              TikTak
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-slate-100">
            <div className="relative" ref={servicesRef}>
              <button
                onClick={() => setServicesOpen((v) => !v)}
                className="flex items-center gap-1 hover:text-cta"
              >
                Services
                <svg className={`w-2.5 h-2.5 transform transition-transform ${servicesOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none">
                  <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {servicesOpen && (
                <div className="absolute left-0 bg-white rounded-lg shadow-md text-slate-700">
                  <ul className="text-sm py-1">
                    {services.map((s) => (
                      <li key={s}>
                        <Link
                          to="/ride"
                          onClick={() => setServicesOpen(false)}
                          className="block px-4 py-1 whitespace-nowrap hover:bg-gray-100 hover:text-cta rounded-lg"
                        >
                          {s}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Link to="/ride" className="hover:text-cta">Book a Ride</Link>
            <Link to="/driver" className="hover:text-cta">Drive with TikTak</Link>
            <a href="/#how" className="hover:text-cta">How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-slate-100">
                  {user.email ?? user.displayName}
                </span>
                <button
                  onClick={onLogoutClick}
                  className="hidden sm:inline text-sm text-slate-100 hover:text-cta"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={onLoginClick}
                className="hidden sm:inline text-sm text-slate-100 hover:text-cta"
              >
                Log in
              </button>
            )}
            <Link
              to="/ride"
              className="bg-cta hover:bg-ctaHover text-white text-sm font-semibold px-4 py-2.5 rounded-full transition min-h-[40px] flex items-center"
            >
              Book Now
            </Link>
            <button
              ref={hamburgerRef}
              className="lg:hidden text-white"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div ref={mobileMenuRef} className="lg:hidden fixed top-16 left-0 w-full h-screen bg-white shadow-lg z-50 px-4 py-4">
            <ul className="text-gray-700 space-y-3">
              {user ? (
                <li><button onClick={onLogoutClick} className="block hover:text-cta">Log out</button></li>
              ) : (
                <li><button onClick={onLoginClick} className="block hover:text-cta">Log in</button></li>
              )}
              <li><Link to="/ride" className="block hover:text-cta" onClick={() => setMobileOpen(false)}>Book a Ride</Link></li>
              <li><Link to="/driver" className="block hover:text-cta" onClick={() => setMobileOpen(false)}>Drive with TikTak</Link></li>
              <li><a href="/#how" className="block hover:text-cta">How It Works</a></li>
              {services.map((s) => (
                <li key={s}><Link to="/ride" className="block hover:text-cta" onClick={() => setMobileOpen(false)}>{s}</Link></li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </>
  );
}
