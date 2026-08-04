import furnitureImg from "../assets/truck-loading.jpg";
import motorbikeImg from "../assets/track-driver.jpg";
import carImg from "../assets/rental-cars.jpg";
import vanImg from "../assets/truck-park.jpg";
import ebayImg from "../assets/track.jpg";
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
      "Get competitive quotes from trusted movers for sofas, wardrobes, and full furniture sets, delivered safely to your new home or office.",
  },
  {
    slug: "motorbike-transport",
    name: "Motorbike Transport",
    img: motorbikeImg,
    description:
      "Move your motorbike locally or across the country with experienced transporters who handle two-wheelers with care.",
  },
  {
    slug: "car-transport",
    name: "Car Transport",
    img: carImg,
    description:
      "Ship your car door-to-door with vetted car transport providers, whether you're relocating or buying/selling remotely.",
  },
  {
    slug: "man-and-van",
    name: "Man And Van",
    img: vanImg,
    description:
      "Flexible man-and-van help for small moves, single items, or quick local jobs at a fraction of standard removal costs.",
  },
  {
    slug: "ebay-deliveries",
    name: "eBay Deliveries",
    img: ebayImg,
    description:
      "TikTak is an official eBay-compatible delivery service. Get your eBay purchase collected and delivered fast.",
  },
  {
    slug: "fragile-item-transport",
    name: "Fragile Item Transport",
    img: fragileImg,
    description:
      "Specialist handling for fragile, delicate, or high-value items, from glassware to electronics and artwork.",
  },
  {
    slug: "boat-transport",
    name: "Boat Transport",
    img: boatImg,
    description:
      "Transport boats and watercraft of all sizes with providers experienced in marine logistics and safe loading.",
  },
  {
    slug: "removals",
    name: "Removals",
    img: removalsImg,
    description:
      "Full home or office removals, from a single room to a complete move, handled by rated removal companies near you.",
  },
];
