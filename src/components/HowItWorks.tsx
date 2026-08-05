import { Link } from "react-router-dom";
import Reveal from "./Reveal";

const steps = [
  { number: "1", text: "Tell us where you are and where you're going in Kigali." },
  { number: "2", text: "The nearest verified driver accepts your request in seconds." },
  { number: "3", text: "Track your taxi live on the map and pay by Mobile Money or cash." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="max-w-7xl mx-auto px-4 lg:px-0 mt-20">
      <div className="py-12 rounded-tr-[100px] bg-slate-800">
        <div className="flex flex-col xl:flex-row items-center gap-2 px-4">
          <div className="flex flex-col items-center w-full">
            <Reveal>
              <h2 className="text-3xl font-bold text-white mb-12">How TikTak Rwanda works</h2>
            </Reveal>
            <div className="lg:pl-[88px] w-full max-w-md">
              {steps.map((step, i) => (
                <Reveal key={step.number} delayMs={i * 120}>
                  <div className="flex items-center mb-8 last:mb-0 group">
                    <div className="w-5 h-5 min-w-[1.25rem] bg-white text-black rounded-full flex items-center justify-center text-xs font-bold mr-3 transition-transform group-hover:scale-125">
                      {step.number}
                    </div>
                    <div className="text-lg text-left text-slate-400">{step.text}</div>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="my-8">
              <Link to="/ride" className="inline-flex items-center text-blue-50 bg-blue-500 hover:bg-blue-600 font-semibold px-5 py-2.5 rounded-full transition shadow-sm hover:shadow-lg hover:scale-105">
                Book a Taxi Now
                <span className="ml-2">-&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
