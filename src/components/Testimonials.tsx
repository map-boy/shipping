const testimonials = [
  { name: "Mark W.", text: "Simple and effective, will be using regularly. Good value and makes moving big things so much easier!" },
  { name: "Sandy B.", text: "In a matter of hours, I received an offer that matched my budget from a company with great feedback." },
  { name: "John G.", text: "Fills the gaps between getting bulky items collected and delivered without doing it yourself. Saves time and money." },
  { name: "Charlotte H.", text: "All went very smoothly and easily. Good communication throughout and would certainly use again." },
];

export default function Testimonials() {
  return (
    <section className="bg-slate-50 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">Recent Testimonials</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white rounded-2xl shadow-sm p-6">
              <div className="w-14 h-14 rounded-full bg-gray-200 mb-4" />
              <p className="text-gray-700 text-sm italic">"{t.text}"</p>
              <div className="mt-4 font-semibold text-gray-900 text-sm">{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
