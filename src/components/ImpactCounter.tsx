import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 2500) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let raf: number;
    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function ImpactCounter() {
  const kg = useCountUp(3652418, 2500);
  const digits = kg.toLocaleString().split("");

  return (
    <section className="relative max-w-7xl mx-auto mt-20 overflow-hidden rounded-tr-[100px] bg-[#08a341]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center md:text-left">
        <h2 className="text-3xl font-bold text-white mb-6">
          How TikTak Helps The Environment
        </h2>
        <p className="text-white">
          By utilising spare capacity of vehicles running on the road, TikTak
          helps reduce the number of otherwise wasteful journeys needed to transport the item.
        </p>
        <div className="flex flex-col items-center mt-8">
          <div className="flex items-center">
            {digits.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-center font-bold text-teal-600 bg-teal-200 h-6 w-6 sm:h-14 sm:w-14 rounded-full mr-1"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="text-white mt-4">
            Kg/CO<sub>2</sub> Saved
          </div>
        </div>
      </div>
    </section>
  );
}

