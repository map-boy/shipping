import heroImg from "../assets/hero.png";

const categories = [
  "Furniture & General Items", "Boxes", "Cars", "Motorcycles",
  "Other Vehicles", "Moving Home", "Haulage", "Boats",
  "Vehicle Parts", "Pianos", "Pets & Livestock", "Other",
];

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-heroFrom to-heroTo pt-28 pb-16 rounded-bl-[100px]">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Delivery firms <br /> <span className="text-cta">compete</span> for your job
          </h1>
          <p className="mt-4 text-lg text-blue-200">
            Save time & money - up to 75% off standard rates
            <br />
            Used by millions of happy customers
          </p>
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-5 space-y-4">
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 h-[50px]">
              <option>What are you shipping?</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Current Location"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 h-[50px]"
            />
            <button className="w-full bg-cta hover:bg-ctaHover text-white font-semibold py-3 rounded-lg transition">
              Receive Quotes In Minutes
            </button>
          </div>
          <div className="mt-4 text-sm text-blue-200">
            4.8/5 - 44,468+ reviews
          </div>
        </div>
        <div id="heroImageContainer" className="hidden md:block">
          <img src={heroImg} alt="Delivery" className="w-full h-auto rounded-2xl" />
        </div>
      </div>
    </section>
  );
}
