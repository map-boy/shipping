import { Link } from "react-router-dom";
import Reveal from "./Reveal";

export default function CTABanner() {
  return (
    <section className="relative bg-slate-800 overflow-hidden">
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-cta/10 blur-3xl" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 relative">
        <Reveal>
          <div className="sm:flex sm:flex-col lg:flex-row justify-between items-center gap-6">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold text-slate-100">
                Have a vehicle? Drive with TikTak Rwanda.
              </h2>
              <p className="mt-2 text-slate-400">Earn on your own schedule across Kigali.</p>
            </div>
            <div>
              <Link to="/driver" className="inline-flex items-center text-blue-50 bg-blue-500 hover:bg-blue-600 font-semibold px-5 py-2.5 rounded-full transition shadow-sm hover:shadow-lg hover:scale-105">
                Drive with TikTak
                <span className="ml-2">-&gt;</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
