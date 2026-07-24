const deliveries = [
  { item: "Antique Cabinet", from: "Bristol, BS15 3JE", to: "North Hykeham, LN6 3QY", price: "£60" },
  { item: "Renault Captur", from: "Edinburgh, EH11", to: "Swindon Village, GL51", price: "£290" },
  { item: "Motorbike", from: "London, EC2A", to: "Barcelona, Spain", price: "£500" },
  { item: "Plasma TV", from: "London, N2 9DB", to: "London, N16 8HR", price: "£40" },
];

const trustPoints = [
  "Move Anything Large or Bulky",
  "Low Prices Guaranteed",
  "Customer Reviewed Transport Providers",
  "Dedicated Trust & Safety Team",
  "Friendly Customer Support Team",
];

export default function RecentDeliveries() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-8 pb-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div className="md:order-1 md:max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Deliveries</h2>
            <p className="text-lg text-slate-500 mb-6">
              Millions of people use YourBrand to move goods around the globe at a much
              more affordable price - by making use of spare capacity along pre-existing routes.
            </p>
            <ul className="flex flex-col text-slate-600 space-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xs mr-3">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-4 overflow-x-auto max-w-full md:max-w-md pb-4">
            {deliveries.map((d) => (
              <div key={d.item} className="flex flex-col bg-white rounded-lg overflow-hidden shadow-lg min-w-[260px]">
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
                  <div className="px-6 py-2 bg-[#fc9d56] text-white font-bold rounded-tl-lg">
                    {d.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
