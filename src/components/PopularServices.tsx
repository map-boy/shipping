import furnitureImg from "../assets/furniture-service.jpg";
import motorbikeImg from "../assets/motorbike-service.jpg";
import carImg from "../assets/car-service.jpg";
import vanImg from "../assets/hero-photo.jpg";
import ebayImg from "../assets/ebay-service.jpg";
import fragileImg from "../assets/fragile-service.jpg";
import boatImg from "../assets/boat-service.jpg";
import removalsImg from "../assets/about-photo.jpg";

const services = [
  { name: "Furniture Delivery", img: furnitureImg },
  { name: "Motorbike Transport", img: motorbikeImg },
  { name: "Car Transport", img: carImg },
  { name: "Man And Van", img: vanImg },
  { name: "eBay Deliveries", img: ebayImg },
  { name: "Fragile Item Transport", img: fragileImg },
  { name: "Boat Transport", img: boatImg },
  { name: "Removals", img: removalsImg },
];

export default function PopularServices() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto border-2 border-slate-100 bg-gradient-to-t from-white rounded-tr-[100px] px-4 sm:px-6 py-8">
        <h2 className="text-center md:text-left text-2xl font-bold text-gray-900 py-8">
          Popular Services
        </h2>
        <div className="flex justify-center">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service, i) => (
              <a key={service.name} href="#" className={`relative bg-gray-200 border border-gray-300 rounded-md overflow-hidden group h-[200px] w-[135px] sm:h-[298px] sm:w-[198px] ${i % 2 === 1 ? "mt-10 sm:mt-20" : ""}`}>
                <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 z-10 pl-2 pb-1 text-left text-white font-bold text-lg">
                  {service.name}
                </span>
                <div className="absolute inset-0 bg-[#1E293B] opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
