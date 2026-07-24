const steps = [
  { number: "1", text: "Request quotes from our 102,334 rated courier services." },
  { number: "2", text: "Compare prices and read previous customer feedback to pick the right delivery quote for you." },
  { number: "3", text: "Sit back and relax while your item is safely delivered by your chosen transport provider." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="max-w-7xl mx-auto px-4 lg:px-0 mt-20">
      <div className="py-12 rounded-tr-[100px] bg-slate-800">
        <div className="flex flex-col xl:flex-row items-center gap-2 px-4">
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-bold text-white mb-12">How YourBrand works</h2>
            <div className="lg:pl-[88px] w-full max-w-md">
              {steps.map((step) => (
                <div key={step.number} className="flex items-center mb-8 last:mb-0">
                  <div className="w-5 h-5 min-w-[1.25rem] bg-white text-black rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    {step.number}
                  </div>
                  <div className="text-lg text-left text-slate-400">{step.text}</div>
                </div>
              ))}
            </div>
            <div className="my-8">
              <a href="#" className="inline-flex items-center text-blue-50 bg-blue-500 hover:bg-blue-600 font-semibold px-5 py-2.5 rounded-full transition shadow-sm">
                Get Quotes Now
                <span className="ml-2">-&gt;</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
