import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
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
import AuthModal from "./components/AuthModal";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar
        user={user}
        onLoginClick={() => setShowAuth(true)}
        onLogoutClick={() => signOut(auth)}
      />
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
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
