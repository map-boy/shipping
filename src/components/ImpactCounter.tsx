import { useEffect, useState } from "react";
import Reveal from "./Reveal";

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
  const rides = useCountUp(48250, 2500);
  const digits = rides.toLocaleString().split("");

  return (
    <section className="relative max-w-7xl mx-auto mt-20 overflow-hidden rounded-tr-[100px] bg-rwGreen">
      <Reveal>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center md:text-left">
          <h2 className="text-3xl font-bold text-white mb-6">
            TikTak Rwanda in Numbers
          </h2>
          <p className="text-white">
            Every day, more Rwandans choose TikTak for a fast, verified, and fairly
            priced ride or delivery across Kigali.
          </p>
          <div className="flex flex-col items-center mt-8">
            <div className="flex items-center">
              {digits.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center font-bold text-teal-600 bg-teal-200 h-6 w-6 sm:h-14 sm:w-14 rounded-full mr-1 transition-transform hover:scale-110"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="text-white mt-4">
              Rides &amp; Deliveries Completed
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
