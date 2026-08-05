import Hero from "./Hero";
import TrustProps from "./TrustProps";
import HowItWorks from "./HowItWorks";
import About from "./About";
import PopularServices from "./PopularServices";
import RecentDeliveries from "./RecentDeliveries";
import ImpactCounter from "./ImpactCounter";
import ReviewBadges from "./ReviewBadges";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import CTABanner from "./CTABanner";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustProps />
      <HowItWorks />
      <About />
      <PopularServices />
      <RecentDeliveries />
      <ImpactCounter />
      <ReviewBadges />
      <Testimonials />
      <FAQ />
      <CTABanner />
    </>
  );
}
