import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TrustProps from "./components/TrustProps";
import HowItWorks from "./components/HowItWorks";
import About from "./components/About";
import ImpactCounter from "./components/ImpactCounter";
import PopularServices from "./components/PopularServices";
import Testimonials from "./components/Testimonials";
import RecentDeliveries from "./components/RecentDeliveries";
import ReviewBadges from "./components/ReviewBadges";
import FAQ from "./components/FAQ";
import CountrySelector from "./components/CountrySelector";
import CTABanner from "./components/CTABanner";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
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
      <Footer />
    </div>
  );
}
