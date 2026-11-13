import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const [open, setOpen] = useState(false);
  const signedIn = useAuth().status === "signedIn";
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <div className="nav-wrap container">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark">
            <ShoppingBag size={18} strokeWidth={2.5} />
          </span>
          <span>
            sell<span className="brand-light">sharp</span>
            <i>.</i>
          </span>
        </Link>
        <nav className={`nav-links ${open ? "nav-open" : ""}`}>
          <NavLink to="/features" onClick={close}>
            Features
          </NavLink>
          <NavLink to="/pricing" onClick={close}>
            Pricing
          </NavLink>
          <NavLink to="/faq" onClick={close}>
            FAQs
          </NavLink>
<<<<<<< HEAD
          <NavLink to="/stores" onClick={close}>
            Stores
          </NavLink>
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
          <NavLink to="/contact" onClick={close}>
            Contact
          </NavLink>
          <div className="mobile-nav-actions">
            {signedIn ? (
<<<<<<< HEAD
              <Link className="btn btn-primary" to="/dashboard" onClick={close}>
=======
              <Link className="btn btn-primary" to="/app" onClick={close}>
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
                Go to dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link className="btn btn-quiet" to="/login" onClick={close}>
                  Log in
                </Link>
                <Link className="btn btn-primary" to="/signup" onClick={close}>
                  Create your store <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="nav-actions">
          {signedIn ? (
<<<<<<< HEAD
            <Link className="btn btn-primary nav-cta" to="/dashboard">
=======
            <Link className="btn btn-primary nav-cta" to="/app">
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
              Dashboard <ArrowUpRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="login-link" to="/login">
                Log in
              </Link>
              <Link className="btn btn-primary nav-cta" to="/signup">
                Get started <ArrowUpRight size={16} />
              </Link>
            </>
          )}
        </div>
        <ThemeToggle />
        <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
