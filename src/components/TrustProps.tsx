import Reveal from "./Reveal";

const items = [
  {
    title: "Fast Pickup",
    desc: "Nearby riders see your request instantly and are on their way in minutes, anywhere in Kigali.",
    icon: "\u26a1",
  },
  {
    title: "Verified Riders",
    desc: "Every driver on TikTak Rwanda is registered and rated by real passengers for your safety.",
    icon: "\ud83d\udee1\ufe0f",
  },
  {
    title: "Fair, Local Pricing",
    desc: "Transparent RWF fares based on distance \u2014 pay by Mobile Money or cash, no surprises.",
    icon: "\ud83d\udcb0",
  },
];

export default function TrustProps() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <Reveal>
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">
          Thousands of Rwandans ride with TikTak
        </h2>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-8">
        {items.map((item, i) => (
          <Reveal key={item.title} delayMs={i * 120}>
            <div className="text-center px-4 py-6 rounded-2xl transition hover:shadow-lg hover:-translate-y-1 duration-300">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="font-semibold text-lg text-gray-900">{item.title}</h3>
              <p className="mt-2 text-gray-600 text-sm">{item.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
