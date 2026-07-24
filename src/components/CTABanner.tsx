export default function CTABanner() {
  return (
    <section className="relative bg-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="sm:flex sm:flex-col lg:flex-row justify-between items-center gap-6">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-100">
              Are you a transport company?
            </h2>
          </div>
          <div>
            <a href="#" className="inline-flex items-center text-blue-50 bg-blue-500 hover:bg-blue-600 font-semibold px-5 py-2.5 rounded-full transition shadow-sm">
              Learn More About YourBrand
              <span className="ml-2">-&gt;</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
