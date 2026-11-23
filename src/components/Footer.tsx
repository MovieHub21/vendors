import { Link, useNavigate } from "react-router-dom";
import { SITE } from "../lib/site";
import { useAuth } from "../auth/useAuth";
import { signOut } from "../services/auth";

export function Footer() {
  const { status } = useAuth();
  const navigate = useNavigate();
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand-col">
          <Link to="/" className="brand brand-footer">
            <img src="/logo-icon.png" alt="Sellsharp" className="brand-logo-img" />
          </Link>
          <p>Less order stress. More time to grow your business.</p>
          <span className="footer-location">Made for ambitious businesses in Nigeria.</span>
        </div>
        <div className="footer-col">
          <b>Product</b>
          <Link to="/features">How it works</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">FAQs</Link>

          <Link to="/stores">Browse stores</Link>

        </div>
        <div className="footer-col">
          <b>Company</b>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div className="footer-col">
          <b>Legal</b>
          <Link to="/terms">Terms of service</Link>
          <Link to="/privacy">Privacy policy</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {SITE.name}. All rights reserved.
        </span>
        <span>Built for the way you sell.</span>
        {status === "signedIn" && <button type="button" className="footer-logout" onClick={async () => { await signOut(); navigate("/", { replace: true }); }}>Log out</button>}
      </div>
    </footer>
  );
}
