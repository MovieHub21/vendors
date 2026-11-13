import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { SITE } from "../lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand-col">
          <Link to="/" className="brand brand-footer">
            <span className="brand-mark">
              <ShoppingBag size={18} />
            </span>
            <span>
              sell<span className="brand-light">sharp</span>
              <i>.</i>
            </span>
          </Link>
          <p>Less order stress. More time to grow your business.</p>
          <span className="footer-location">Made for ambitious businesses in Nigeria.</span>
        </div>
        <div className="footer-col">
          <b>Product</b>
          <Link to="/features">Features</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">FAQs</Link>
<<<<<<< HEAD
          <Link to="/stores">Browse stores</Link>
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
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
      </div>
    </footer>
  );
}
