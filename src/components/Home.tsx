import Hero from "./Hero";
import TrustProps from "./TrustProps";
import HowItWorks from "./HowItWorks";
import About from "./About";
import PopularServices from "./PopularServices";
import ReviewBadges from "./ReviewBadges";
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
      <ReviewBadges />
      <FAQ />
      <CTABanner />
    </>
  );
}

