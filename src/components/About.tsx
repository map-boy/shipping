import aboutImg from "../assets/about-photo.jpg";
import Reveal from "./Reveal";

export default function About() {
  return (
    <section id="about" className="relative mt-20">
      <div className="max-w-7xl mx-auto bg-gradient-to-b from-slate-100 rounded-tl-[100px] px-4 sm:px-6 pt-12 md:pt-20 pb-12">
        <Reveal>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-8 text-center md:text-left">
            More about TikTak Rwanda
          </h2>
        </Reveal>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Reveal className="w-full md:w-2/3">
            <p className="text-lg text-slate-500 text-justify">
              TikTak Rwanda connects passengers and senders with nearby taxi
              drivers across Kigali and beyond. Request a ride or a delivery, see
              real-time prices in RWF, and track your driver live on the map from
              pickup to drop-off. Every driver on the platform is verified and rated,
              so you always know who's picking you up. Whether you're heading across
              town or sending a parcel to a friend, TikTak makes it fast, safe, and
              affordable &mdash; with payment by Mobile Money or cash.
            </p>
          </Reveal>
          <Reveal className="w-full md:w-1/3" delayMs={150}>
            <img src={aboutImg} alt="TikTak Rwanda taxi driver" className="w-full h-auto rounded-xl shadow-lg transition hover:shadow-2xl duration-300" loading="lazy" decoding="async" width="600" height="450" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
