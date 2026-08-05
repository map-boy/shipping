import furnitureImg from "../assets/truck-loading.jpg";
import taxiImg from "../assets/track-driver.jpg";
import carImg from "../assets/rental-cars.jpg";
import vanImg from "../assets/truck-park.jpg";
import parcelImg from "../assets/track.jpg";
import fragileImg from "../assets/fragile-service.jpg";
import boatImg from "../assets/boat-lake-kivu.jpg";
import removalsImg from "../assets/KIGALI (1).jpg";

export interface ServiceInfo {
  slug: string;
  name: string;
  img: string;
  description: string;
}

export const services: ServiceInfo[] = [
  {
    slug: "furniture-delivery",
    name: "Furniture Delivery",
    img: furnitureImg,
    description:
      "Book a verified driver to move sofas, wardrobes, and furniture sets safely to your new home or office in Kigali.",
  },
  {
    slug: "passenger-taxi",
    name: "Passenger Taxi Ride",
    img: taxiImg,
    description:
      "Get a nearby taxi in minutes for a fast, affordable ride anywhere in Kigali \u2014 live tracked from pickup to drop-off.",
  },
  {
    slug: "car-transport",
    name: "VIP Car Ride",
    img: carImg,
    description:
      "Prefer more comfort? Book a VIP taxi for extra space, with the same live tracking and Mobile Money payment.",
  },
  {
    slug: "man-and-van",
    name: "Truck & Van Delivery",
    img: vanImg,
    description:
      "Flexible truck and van delivery for small moves, market goods, or bulky items at fair, distance-based RWF pricing.",
  },
  {
    slug: "parcel-delivery",
    name: "Parcel & Package Delivery",
    img: parcelImg,
    description:
      "Send documents and packages across Kigali with real-time tracking, from your door to theirs.",
  },
  {
    slug: "fragile-item-transport",
    name: "Fragile Item Transport",
    img: fragileImg,
    description:
      "Careful handling for delicate or high-value items, from electronics to glassware, by drivers who know how to keep them safe.",
  },
  {
    slug: "boat-transport",
    name: "Lake Kivu Transport",
    img: boatImg,
    description:
      "Coordinate transport to and from Lake Kivu and other regional destinations with drivers experienced in longer trips.",
  },
  {
    slug: "removals",
    name: "Home & Office Removals",
    img: removalsImg,
    description:
      "Full home or office moves in Kigali, from a single room to a complete relocation, handled by rated local drivers.",
  },
];
