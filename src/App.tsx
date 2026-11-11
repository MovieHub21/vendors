import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { RequireAuth } from "./auth/RequireAuth";
import MarketingLayout from "./layouts/MarketingLayout";
import { REDIRECT_ROUTES } from "./lib/routes";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import Faq from "./pages/Faq";
import Features from "./pages/Features";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import PaymentResult from "./pages/PaymentResult";
import Pricing from "./pages/Pricing";
import ProductPage from "./pages/ProductPage";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import Storefront from "./pages/Storefront";

/**
 * Route order does not matter: React Router ranks static segments above `/:storeSlug`, so real pages always win.
 * Keep every static path in lib/routes.ts so it is automatically reserved as a store username.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Legal type="terms" />} />
          <Route path="/privacy" element={<Legal type="privacy" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />
          <Route
            path="/onboarding/payment"
            element={
              <RequireAuth>
                <PaymentResult />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
        {Object.entries(REDIRECT_ROUTES).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}
        <Route path="/:storeSlug" element={<Storefront />} />
        <Route path="/:storeSlug/product/:productSlug" element={<ProductPage />} />
      </Routes>
    </ThemeProvider>
  );
}
