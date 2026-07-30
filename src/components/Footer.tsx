import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative bg-slate-800 text-slate-300 pt-8 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-8 py-8 border-t border-slate-700">
          <div className="col-span-2 sm:col-span-12 lg:col-span-2">
            <div className="text-white font-bold text-xl">TikTak</div>
          </div>
          <div className="col-span-1 sm:col-span-6 lg:col-span-2">
            <p className="text-sm text-slate-100 font-bold mb-3">Services</p>
            <ul className="text-sm space-y-2">
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Courier Services</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Large Item Delivery</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Man And Van</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">European Transport</Link></li>
            </ul>
          </div>
          <div className="col-span-1 sm:col-span-6 lg:col-span-2">
            <p className="text-sm text-slate-100 font-bold mb-3">&nbsp;</p>
            <ul className="text-sm space-y-2">
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Pet Transport</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">International Shipping</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Removals</Link></li>
              <li><Link to="/ride" className="text-slate-400 hover:text-blue-500 transition">Haulage</Link></li>
            </ul>
          </div>
          <div className="col-span-1 sm:col-span-6 lg:col-span-2">
            <p className="text-sm text-slate-100 font-bold mb-3">Company</p>
            <ul className="text-sm space-y-2">
              <li><a href="/#about" className="text-slate-400 hover:text-blue-500 transition">About</a></li>
            </ul>
          </div>
        </div>
        <div className="pb-4 text-xs text-slate-500">
          TikTak Ltd. &copy; 2026.
        </div>
      </div>
    </footer>
  );
}
