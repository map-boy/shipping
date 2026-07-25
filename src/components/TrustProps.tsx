const items = [
  {
    title: "Fast and Easy",
    desc: "Complete one simple form and quotes come to you via email. Hassle-free, no phone calls required.",
    icon: "⚡",
  },
  {
    title: "Trustworthy",
    desc: "All delivery companies on our platform are feedback rated for your peace of mind.",
    icon: "🛡️",
  },
  {
    title: "Great Prices",
    desc: "As providers are already making similar trips, quotes are up to 75% cheaper than standard rates.",
    icon: "💰",
  },
];

export default function TrustProps() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">
        Millions of people use TikTak
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {items.map((item) => (
          <div key={item.title} className="text-center px-4">
            <div className="text-4xl mb-4">{item.icon}</div>
            <h3 className="font-semibold text-lg text-gray-900">{item.title}</h3>
            <p className="mt-2 text-gray-600 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

