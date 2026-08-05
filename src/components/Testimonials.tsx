import Reveal from "./Reveal";

const testimonials = [
  { name: "Eric N.", text: "I book a taxi almost every day for work. Drivers show up fast and I can see them coming on the map." },
  { name: "Aline U.", text: "Sent a parcel to my sister in Remera and it arrived in under 30 minutes. Very easy to use." },
  { name: "Jean Paul H.", text: "Paying with Mobile Money is smooth and I always know the price before I book. No surprises." },
  { name: "Diane K.", text: "As a driver, TikTak keeps me busy with nearby requests and the app is simple to use on the road." },
];

export default function Testimonials() {
  return (
    <section className="bg-slate-50 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">What Kigali riders are saying</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delayMs={i * 100}>
              <div className="bg-white rounded-2xl shadow-sm p-6 transition hover:shadow-lg hover:-translate-y-1 duration-300">
                <div className="w-14 h-14 rounded-full bg-gray-200 mb-4" />
                <p className="text-gray-700 text-sm italic">"{t.text}"</p>
                <div className="mt-4 font-semibold text-gray-900 text-sm">{t.name}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
