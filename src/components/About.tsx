import aboutImg from "../assets/about-photo.jpg";

export default function About() {
  return (
    <section className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-12 md:pt-20 pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-8 text-center md:text-left">
          More about TikTak
        </h2>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-full md:w-2/3">
            <p className="text-lg text-slate-500 text-justify">
              TikTak makes it simple to get delivery quotes: fill out one short form
              and competitive offers arrive by email from a large network of trusted
              delivery companies, often well below standard rates. Every provider is
              feedback-rated so you know what to expect. Courier partners take on these
              jobs because it lets them fill spare space on routes they already run,
              which is how the savings get passed on to you. Small parcels are usually
              better suited to a standard postal service, but for large, heavy, or
              awkward items, TikTak connects you with experienced movers for both
              local and international delivery.
            </p>
          </div>
          <div className="w-full md:w-1/3">
            <img src={aboutImg} alt="More about TikTak" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}


