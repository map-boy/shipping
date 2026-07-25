import Hero from "./Hero";
import TrustProps from "./TrustProps";
import HowItWorks from "./HowItWorks";
import About from "./About";
import ImpactCounter from "./ImpactCounter";
import PopularServices from "./PopularServices";
import Testimonials from "./Testimonials";
import RecentDeliveries from "./RecentDeliveries";
import ReviewBadges from "./ReviewBadges";
import FAQ from "./FAQ";
import CountrySelector from "./CountrySelector";
import CTABanner from "./CTABanner";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustProps />
      <HowItWorks />
      <About />
      <ImpactCounter />
      <PopularServices />
      <Testimonials />
      <RecentDeliveries />
      <ReviewBadges />
      <FAQ />
      <CountrySelector />
      <CTABanner />
    </>
  );
}
