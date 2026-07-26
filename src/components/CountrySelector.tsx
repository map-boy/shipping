import { Link } from "react-router-dom";

const countries = ["Australia", "Canada", "France", "Germany", "India", "Italy", "Brazil", "Mexico", "Spain", "United Kingdom", "USA"];

export default function CountrySelector() {
  return (
    <section className="pb-20 text-center max-w-7xl mx-auto px-4 sm:px-6">
      <ul className="flex flex-wrap justify-center gap-4">
        {countries.map((c) => (
          <li key={c}>
            <Link to="/ride" className="flex items-center gap-2 group">
              <span className="w-4 h-3 bg-gray-300 rounded-sm inline-block" />
              <span className="text-gray-500 group-hover:text-heroTo transition duration-150 ease-in-out">
                {c}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
