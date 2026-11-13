import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { RequireAuth } from "./auth/RequireAuth";
import MarketingLayout from "./layouts/MarketingLayout";
import { REDIRECT_ROUTES } from "./lib/routes";
import About from "./pages/About";
import Contact from "./pages/Contact";

import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import DashboardSeo from "./pages/DashboardSeo";

import Faq from "./pages/Faq";
import Features from "./pages/Features";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";

import Orders from "./pages/Orders";
import PaymentResult from "./pages/PaymentResult";
import Products from "./pages/Products";
import ReceiptPage from "./pages/ReceiptPage";
import RecordSale from "./pages/RecordSale";
import Pricing from "./pages/Pricing";
import PublicPage from "./pages/public/PublicPage";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";


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

            path="/dashboard"

            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/dashboard/seo"
            element={
              <RequireAuth>
                <DashboardSeo />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/sale"
            element={
              <RequireAuth>
                <RecordSale />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/customers"
            element={
              <RequireAuth>
                <Customers />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/products"
            element={
              <RequireAuth>
                <Products />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/receipt/:orderId"
            element={
              <RequireAuth>
                <ReceiptPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
        {Object.entries(REDIRECT_ROUTES).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/* Every dynamic public page. The server renders these (src/edge) so crawlers receive real HTML. */}
        <Route path="/stores" element={<PublicPage />} />
        <Route path="/stores/:facet" element={<PublicPage />} />
        <Route path="/:storeSlug" element={<PublicPage />} />
        <Route path="/:storeSlug/products" element={<PublicPage />} />
        <Route path="/:storeSlug/about" element={<PublicPage />} />
        <Route path="/:storeSlug/products/:productSlug" element={<PublicPage />} />

      </Routes>
    </ThemeProvider>
  );
}
