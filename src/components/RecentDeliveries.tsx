import Reveal from "./Reveal";

const deliveries = [
  { item: "Passenger Ride", from: "Kimironko, Kigali", to: "Nyabugogo, Kigali", price: "2,400 RWF" },
  { item: "Office Parcel", from: "Kacyiru, Kigali", to: "Remera, Kigali", price: "1,800 RWF" },
  { item: "Airport Transfer", from: "Kigali International Airport", to: "Kimihurura, Kigali", price: "6,500 RWF" },
  { item: "Market Goods", from: "Kimisagara Market", to: "Gikondo, Kigali", price: "3,200 RWF" },
];

const trustPoints = [
  "Move Anything, Large or Small",
  "Fair, Distance-Based RWF Pricing",
  "Verified & Rated Drivers",
  "Dedicated Trust & Safety Team",
  "Friendly Customer Support Team",
];

export default function RecentDeliveries() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-8 pb-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <Reveal className="md:order-1 md:max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Rides &amp; Deliveries</h2>
            <p className="text-lg text-slate-500 mb-6">
              Thousands of people across Kigali use TikTak Rwanda every day to get
              around and move goods quickly, at a fair local price.
            </p>
            <ul className="flex flex-col text-slate-600 space-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xs mr-3">&#10003;</span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="flex gap-4 overflow-x-auto max-w-full md:max-w-md pb-4">
            {deliveries.map((d, i) => (
              <Reveal key={d.item} delayMs={i * 100}>
                <div className="flex flex-col bg-white rounded-lg overflow-hidden shadow-lg min-w-[260px] transition hover:-translate-y-1 hover:shadow-xl duration-300">
                  <div className="w-full h-[160px] bg-gray-200" />
                  <div className="px-6 pt-4">
                    <div className="font-bold text-xl mb-2">{d.item}</div>
                    <div className="text-gray-700 flex flex-col text-sm">
                      <div>{d.from}</div>
                      <div className="w-px h-6 bg-gray-300 ml-1 my-1" />
                      <div>{d.to}</div>
                    </div>
                  </div>
                  <div className="flex justify-end items-center mt-2">
                    <div className="px-6 py-2 bg-cta text-white font-bold rounded-tl-lg">
                      {d.price}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
