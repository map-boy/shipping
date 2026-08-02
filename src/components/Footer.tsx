import { Link } from "react-router-dom";

const socials = [
  { label: "Facebook", href: "#", path: "M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.891h-2.33v6.987C18.343 21.128 22 16.991 22 12z" },
  { label: "Instagram", href: "#", path: "M12 2c-2.72 0-3.06.012-4.123.06-1.062.049-1.79.218-2.425.465a4.9 4.9 0 0 0-1.771 1.153A4.9 4.9 0 0 0 2.525 5.45c-.247.636-.416 1.363-.465 2.425C2.012 8.94 2 9.28 2 12s.012 3.06.06 4.123c.049 1.062.218 1.789.465 2.425a4.9 4.9 0 0 0 1.153 1.771 4.9 4.9 0 0 0 1.771 1.153c.636.247 1.363.416 2.425.465C8.94 21.988 9.28 22 12 22s3.06-.012 4.123-.06c1.062-.049 1.789-.218 2.425-.465a4.9 4.9 0 0 0 1.771-1.153 4.9 4.9 0 0 0 1.153-1.771c.247-.636.416-1.363.465-2.425.048-1.063.06-1.403.06-4.123s-.012-3.06-.06-4.123c-.049-1.062-.218-1.79-.465-2.425a4.9 4.9 0 0 0-1.153-1.771A4.9 4.9 0 0 0 18.548.525c-.636-.247-1.363-.416-2.425-.465C15.06.012 14.72 0 12 0zm0 5.838a6.162 6.162 0 1 1 0 12.324 6.162 6.162 0 0 1 0-12.324zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6.406-11.845a1.44 1.44 0 1 1 0 2.881 1.44 1.44 0 0 1 0-2.881z" },
  { label: "YouTube", href: "#", path: "M23.498 6.186a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.02 3.02 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { label: "X", href: "#", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" },
  { label: "WhatsApp", href: "#", path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.148.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.004 2.003a9.98 9.98 0 0 0-8.5 15.24l-1.1 4.02 4.12-1.08a9.98 9.98 0 1 0 5.48-18.18zm0 18.16a8.16 8.16 0 0 1-4.16-1.14l-.298-.176-2.446.642.654-2.386-.194-.245A8.17 8.17 0 1 1 12.004 20.16z" },
];

export default function Footer() {
  return (
    <footer className="relative bg-slate-900 text-slate-300 pt-14 pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-10 pb-10">

          <div className="col-span-2 sm:col-span-12 lg:col-span-3">
            <h3 className="text-white font-bold text-lg mb-2">About Us</h3>
            <div className="w-10 h-0.5 bg-red-600 mb-4"></div>
            <p className="text-sm text-slate-400 leading-relaxed">
              TikTak connects riders and senders with nearby drivers for people
              and goods transport, cars, motorbikes, and vans, with live
              tracking and Mobile Money payments.
            </p>
            <div className="flex gap-2 mt-5">
              {socials.map((s) => (<a key={s.label} href={s.href} aria-label={s.label} className="w-9 h-9 rounded-full border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-cta hover:border-cta hover:text-white transition"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d={s.path} /></svg></a>))}
            </div>
          </div>

          <div className="col-span-1 sm:col-span-6 lg:col-span-3">
            <h3 className="text-white font-bold text-lg mb-2">Services</h3>
            <div className="w-10 h-0.5 bg-red-600 mb-4"></div>
            <ul className="text-sm space-y-2">
              <li><Link to="/ride" className="hover:text-cta transition">Book a Ride</Link></li>
              <li><Link to="/ride" className="hover:text-cta transition">Courier Services</Link></li>
              <li><Link to="/ride" className="hover:text-cta transition">Large Item Delivery</Link></li>
              <li><Link to="/ride" className="hover:text-cta transition">Man And Van</Link></li>
              <li><Link to="/driver" className="hover:text-cta transition">Drive with TikTak</Link></li>
            </ul>
          </div>

          <div className="col-span-1 sm:col-span-6 lg:col-span-3">
            <h3 className="text-white font-bold text-lg mb-2">Quick Links</h3>
            <div className="w-10 h-0.5 bg-red-600 mb-4"></div>
            <ul className="text-sm space-y-2">
              <li><Link to="/" className="hover:text-cta transition">Home</Link></li>
              <li><a href="/#about" className="hover:text-cta transition">About Us</a></li>
              <li><a href="/#how" className="hover:text-cta transition">How It Works</a></li>
              <li><a href="/#faq" className="hover:text-cta transition">FAQ</a></li>
              <li><Link to="/driver" className="hover:text-cta transition">Become a Driver</Link></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-12 lg:col-span-3">
            <h3 className="text-white font-bold text-lg mb-2">Contact Us</h3>
            <div className="w-10 h-0.5 bg-red-600 mb-4"></div>
            <ul className="text-sm space-y-3 text-slate-400">
              <li>+250 7XX XXX XXX</li>
              <li>support@tiktak.rw</li>
              <li>Monday - Sunday: 6:00 AM - 11:00 PM</li>
              <li>Kigali, Rwanda</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-5 text-xs text-slate-500 text-center">
          Copyright {new Date().getFullYear()} | All Rights Reserved - TikTak Ltd.
        </div>
      </div>
    </footer>
  );
}
