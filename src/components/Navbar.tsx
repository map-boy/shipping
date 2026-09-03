import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { services } from "../lib/services";
import { useCart } from "../context/cart";

interface NavbarProps {
  user: User | null;
  onLoginClick: () => void;
}

export default function Navbar({ user, onLoginClick }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { itemCount } = useCart();

  function isActive(path: string) {
    return location.pathname === path;
  }

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

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setServicesOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2";

  return (
    <>
      <div className="bg-black py-1.5 px-4">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex gap-3 text-[11px] sm:text-xs text-slate-300 overflow-x-auto whitespace-nowrap">
            <li><a href="/" className={`text-white rounded ${focusRing} focus-visible:ring-offset-black`}>Personal Use</a></li>
            <li className="text-slate-500">Business Use (coming soon)</li>
            <li><Link to="/driver" className={`hover:text-white transition-colors rounded ${focusRing} focus-visible:ring-offset-black`}>Transport Providers</Link></li>
          </ul>
        </div>
      </div>

      <header className="relative bg-ink w-full z-30">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <Link to="/" className={`flex items-center gap-2 rounded ${focusRing} focus-visible:ring-offset-black`}>
              <svg width="28" height="28" viewBox="0 0 64 64"><defs><linearGradient id="navlogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fea142"/><stop offset="100%" stop-color="#f98b1b"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="url(#navlogo)"/><path d="M32 14c-7.2 0-13 5.8-13 13 0 9.7 13 23 13 23s13-13.3 13-23c0-7.2-5.8-13-13-13z" fill="white"/><circle cx="32" cy="27" r="5.5" fill="#0f4c8b"/></svg>
              TikTak
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-base text-slate-100">
            <div className="relative" ref={servicesRef}>
              <button
                onClick={() => setServicesOpen((v) => !v)}
                aria-expanded={servicesOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 hover:text-white/70 transition-colors rounded ${focusRing} focus-visible:ring-offset-black`}
              >
                Services
                <svg className={`w-2.5 h-2.5 transform transition-transform ${servicesOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none">
                  <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {servicesOpen && (
                <div className="absolute left-0 bg-white rounded-lg shadow-md text-slate-700 animate-fadeInUp">
                  <ul className="text-sm py-1">
                    {services.map((s) => (
                      <li key={s.slug}>
                        <Link
                          to={`/services/${s.slug}`}
                          onClick={() => setServicesOpen(false)}
                          className={`block px-4 py-1 whitespace-nowrap hover:bg-gray-100 hover:text-white/70 rounded-lg transition-colors ${focusRing} focus-visible:ring-offset-white`}
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Link to="/ride" className={`relative pb-1 transition-colors hover:text-white/70 rounded ${focusRing} focus-visible:ring-offset-black ${isActive("/ride") ? "text-white after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-0.5 after:bg-white after:rounded-full" : ""}`}>
              Book a Ride
            </Link>
            <Link to="/driver" className={`relative pb-1 transition-colors hover:text-white/70 rounded ${focusRing} focus-visible:ring-offset-black ${isActive("/driver") ? "text-white after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-0.5 after:bg-white after:rounded-full" : ""}`}>
              Drive with TikTak
            </Link>
            <a href="/#how" className={`hover:text-white/70 transition-colors rounded ${focusRing} focus-visible:ring-offset-black`}>How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/cart"
              aria-label="Cart"
              className={`relative flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-100 hover:text-white/70 transition-colors rounded ${focusRing} focus-visible:ring-offset-black`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.938-4.716 2.426-7.218a1.125 1.125 0 00-1.11-1.325H5.106M7.5 14.25L5.106 5.25M7.5 14.25L5.25 12M12 15.75h.008v.008H12v-.008z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-cta text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className={`hidden sm:flex items-center gap-1.5 text-sm hover:text-white/70 border rounded-full px-3 py-1.5 transition-colors ${focusRing} focus-visible:ring-offset-black ${isActive("/profile") ? "text-cta border-cta" : "text-slate-100 border-slate-600 hover:border-cta"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Profile
                </Link>
              </>
            ) : (
              <button
                onClick={onLoginClick}
                className={`hidden sm:inline text-sm text-slate-100 hover:text-white/70 transition-colors rounded ${focusRing} focus-visible:ring-offset-black`}
              >
                Log in
              </button>
            )}
            <Link
              to="/ride"
              className={`bg-white text-ink text-sm font-semibold px-5 py-2.5 rounded-full transition min-h-[44px] flex items-center active:bg-line ${focusRing} focus-visible:ring-offset-black`}
            >
              Book
            </Link>
            <button
              ref={hamburgerRef}
              className={`lg:hidden text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${focusRing} focus-visible:ring-offset-black`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div ref={mobileMenuRef} className="lg:hidden fixed top-16 left-0 w-full h-screen bg-white shadow-lg z-50 px-4 py-4 animate-fadeInUp">
            <ul className="text-gray-700 space-y-3 text-base">
              {user ? (
                <li><Link to="/profile" className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white ${isActive("/profile") ? "text-cta font-semibold" : ""}`} onClick={() => setMobileOpen(false)}>Profile</Link></li>
              ) : (
                <li><button onClick={onLoginClick} className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white`}>Log in</button></li>
              )}
              <li>
                <Link to="/cart" className={`flex items-center gap-2 hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white ${isActive("/cart") ? "text-cta font-semibold" : ""}`} onClick={() => setMobileOpen(false)}>
                  Cart{itemCount > 0 ? ` (${itemCount})` : ""}
                </Link>
              </li>
              <li><Link to="/ride" className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white ${isActive("/ride") ? "text-cta font-semibold" : ""}`} onClick={() => setMobileOpen(false)}>Book a Ride</Link></li>
              <li><Link to="/truck" className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white ${isActive("/truck") ? "text-cta font-semibold" : ""}`} onClick={() => setMobileOpen(false)}>Book a Truck</Link></li>
              <li><Link to="/driver" className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white ${isActive("/driver") ? "text-cta font-semibold" : ""}`} onClick={() => setMobileOpen(false)}>Drive with TikTak</Link></li>
              <li><a href="/#how" className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white`}>How It Works</a></li>
              {services.map((s) => (
                <li key={s.slug}><Link to={`/services/${s.slug}`} className={`block hover:text-white/70 py-2 rounded ${focusRing} focus-visible:ring-offset-white`} onClick={() => setMobileOpen(false)}>{s.name}</Link></li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </>
  );
}