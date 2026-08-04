import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import RidePage from "./components/RidePage";
import DriverPage from "./components/DriverPage";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import Profile from "./components/Profile";
import ServicePage from "./components/ServicePage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white">
        <Navbar
          user={user}
          onLoginClick={() => setShowAuth(true)}
          onLogoutClick={() => signOut(auth)}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ride" element={<RidePage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/profile" element={<Profile user={user} onLogoutClick={() => signOut(auth)} />} />
          <Route path="/services/:slug" element={<ServicePage />} />
        </Routes>
        <Footer />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    </BrowserRouter>
  );
}
