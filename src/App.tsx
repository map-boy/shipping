import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import { ToastProvider } from "./components/Toast";
import { CartProvider } from "./components/Cart";

const RidePage = lazy(() => import("./components/RidePage"));
const DriverPage = lazy(() => import("./components/DriverPage"));
const Profile = lazy(() => import("./components/Profile"));
const ServicePage = lazy(() => import("./components/ServicePage"));
const CartPage = lazy(() => import("./components/CartPage"));

function RouteLoading() {
  return (
    <div className="w-full h-[60vh] flex items-center justify-center">
      <span className="w-8 h-8 border-4 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return (
    <ToastProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-white">
            <Navbar
              user={user}
              onLoginClick={() => setShowAuth(true)}
            />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/ride" element={<RidePage />} />
                <Route path="/driver" element={<DriverPage />} />
                <Route path="/profile" element={<Profile user={user} onLogoutClick={() => signOut(auth)} />} />
                <Route path="/services/:slug" element={<ServicePage />} />
                <Route path="/cart" element={<CartPage />} />
              </Routes>
            </Suspense>
            <Footer />
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
          </div>
        </BrowserRouter>
      </CartProvider>
    </ToastProvider>
  );
}