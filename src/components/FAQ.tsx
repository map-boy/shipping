import Reveal from "./Reveal";

const col1 = [
  { q: "Where does TikTak Rwanda operate?", a: "TikTak currently operates across Kigali, with coverage expanding to other Rwandan cities as more drivers join the platform." },
  { q: "How do I book a taxi?", a: "Open the Ride page, search your destination, choose a vehicle type, and tap Book. The nearest available driver is notified instantly." },
  { q: "How is the fare calculated?", a: "Fares are based on distance and vehicle type (Standard, Truck, or VIP), shown to you in RWF before you confirm your booking - no hidden fees." },
  { q: "Can I send a package instead of riding myself?", a: "Yes. Choose Goods when booking, describe what you're sending, and a nearby driver will pick it up and deliver it to your recipient." },
  { q: "Are TikTak drivers verified?", a: "Every driver goes through registration and ID verification before they can accept trips, and passengers can see their rating." },
  { q: "What vehicle types are available?", a: "Standard for everyday trips, Truck for bulky items and larger loads, and VIP for extra comfort - all shown with live pricing before you book." },
];

const col2 = [
  { q: "How do I pay?", a: "Pay directly in the app via Mobile Money, or mark your trip as paid in cash with your driver at the end of the ride." },
  { q: "Can I track my driver in real time?", a: "Yes. Once a driver accepts your trip, their live location, route, and estimated arrival time are shown on the map." },
  { q: "What if I need to cancel my request?", a: "You can cancel a ride from your active trip screen at any time before a driver accepts it, at no charge." },
  { q: "Is my payment protected?", a: "Trips only mark as complete once payment is confirmed as successful or cash-paid, so both you and your driver have a clear record." },
  { q: "How can I contact TikTak Support?", a: "Reach our support team daily from 6:00 AM to 11:00 PM at support@tiktak.rw or through the contact details in the footer." },
  { q: "How do I become a driver?", a: "Visit the Transport Providers page, go online with your vehicle type, and start receiving nearby trip requests right away." },
];

export default function FAQ() {
  return (
    <section id="help" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <Reveal>
        <div className="pb-20">
          <h2 className="text-3xl font-bold text-gray-900">FAQs</h2>
        </div>
      </Reveal>
      <div className="md:flex md:space-x-12 space-y-8 md:space-y-0">
        <div className="w-full md:w-1/2 space-y-8">
          {col1.map((faq, i) => (
            <Reveal key={faq.q} delayMs={i * 80}>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-gray-900">{faq.q}</h4>
                <p className="text-slate-600">{faq.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="w-full md:w-1/2 space-y-8">
          {col2.map((faq, i) => (
            <Reveal key={faq.q} delayMs={i * 80}>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-gray-900">{faq.q}</h4>
                <p className="text-slate-600">{faq.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
