import type { VehicleType } from "./catalog";

/**
 * What the home page advertises, and how each one is priced.
 *
 * `bookHref` carries the vehicle so a card links straight into the booking flow
 * with that service already chosen - and, crucially, into the *same* flow, so
 * every service is priced by the one server-side tariff for it. A separate
 * booking screen per service is how the truck formula drifted before.
 */
export interface ServiceOffer {
  slug: string;
  name: string;
  vehicle: VehicleType;
  summary: string;
  /** Plain-language pricing, so a customer knows before they start. */
  pricing: string;
  detail: string[];
  bookHref: string;
}

export const SERVICE_OFFERS: ServiceOffer[] = [
  {
    slug: "truck",
    name: "Truck freight",
    vehicle: "truck",
    summary:
      "Move goods by truck anywhere in Rwanda, billed either by the weight you are sending or by the number of truckloads.",
    pricing: "By tonnes: 250,000 RWF + (0.25 x tonnes x km). By tours: 0.25 x tours x km x 30 (a tour fills the truck).",
    detail: [
      "Choose tonnes for boxed or crated goods you can weigh",
      "Choose tours when you are hiring whole truckloads",
      "A delivery code confirms the goods reached the right hands",
    ],
    bookHref: "/book?vehicle=truck",
  },
  {
    slug: "bus",
    name: "Bus charter",
    vehicle: "bus",
    summary:
      "Hire a 29-seat bus for a group. The bus drives out and comes back, so the round trip is what you pay for.",
    pricing: "Up to 50 km each way: flat 200,000 RWF. Beyond that: 90 RWF x 29 seats x round-trip km.",
    detail: [
      "Kigali to Kayonza, 85 km each way, is 443,700 RWF",
      "The whole bus is yours; the price does not change with passenger count",
      "Weddings, school trips, staff transport, funerals",
    ],
    bookHref: "/book?vehicle=bus",
  },
  {
    slug: "vip",
    name: "VIP car",
    vehicle: "vip",
    summary: "A private car with more room and comfort, for airport runs, guests and business travel.",
    pricing: "2,500 RWF base + 900 RWF per km.",
    detail: ["Passengers only", "Live tracking from pickup to drop-off", "Pay by Mobile Money or cash"],
    bookHref: "/book?vehicle=vip",
  },
  {
    slug: "car-hire",
    name: "Small car hire",
    vehicle: "car_hire",
    summary: "Hire a small car with a driver for errands, deliveries and short trips around town.",
    pricing: "3,000 RWF base + 250 RWF per km.",
    detail: ["Carries people or small loads up to 100 kg", "Lower per-km rate than a standard ride"],
    bookHref: "/book?vehicle=car_hire",
  },
  {
    slug: "standard",
    name: "Standard ride",
    vehicle: "standard",
    summary: "An everyday car for getting across the city, and for parcels up to 50 kg.",
    pricing: "500 RWF base + 300 RWF per km. Busy periods may add up to 2.5x.",
    detail: [
      "The quickest to dispatch: nearest suitable driver is offered the job first",
      "Same-day parcels up to 50 kg",
    ],
    bookHref: "/book?vehicle=standard",
  },
];
