import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardPreview } from "../components/DashboardPreview";
import { SectionHeading } from "../components/SectionHeading";
import { Seo } from "../components/Seo";
import { HOME_FEATURES } from "../data/features";
import { PAGE_META } from "../data/pageMeta";
import { organizationJsonLd, websiteJsonLd } from "../lib/seo";

export default function Home() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.home, jsonLd: [organizationJsonLd(), websiteJsonLd()] }} />
      <section className="hero-section">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" /> A simpler way to run your online business <ArrowUpRight size={13} />
            </div>
            <h1>
<<<<<<< HEAD
              Your business deserves
              <br />
              its own <em>online store</em>.
=======
              Your business,
              <br />
              in <em>better</em> order.
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
            </h1>
            <p className="hero-sub">
              Orders in your chats. Customers in your head. Payments in different places. Bring it all together with one
              simple store and business dashboard.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-large">
                Create your store <ArrowRight size={17} />
              </Link>
              <Link to="/features" className="text-link">
                See how it works <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars">
                <span>A</span>
                <span>J</span>
                <span>K</span>
                <span>+</span>
              </div>
              <p>
                Made for the people building
                <br />
                <b>businesses one order at a time.</b>
              </p>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-orbit orbit-a" />
            <div className="visual-orbit orbit-b" />
            <div className="floating-tag tag-orders">
              <span className="tag-icon">
                <ShoppingBag size={15} />
              </span>
              <div>
                <b>New order received</b>
                <small>₦24,500 · Just now</small>
              </div>
              <CheckCircle2 size={17} className="tag-check" />
            </div>
            <DashboardPreview />
            <div className="floating-tag tag-receipt">
              <span className="receipt-icon">
                <FileText size={16} />
              </span>
              <div>
                <b>Receipt ready</b>
                <small>Sent to customer</small>
              </div>
              <Check size={16} className="tag-check" />
            </div>
          </div>
        </div>
        <div className="container hero-bottom">
          <span>ONE HOME FOR YOUR</span>
          <div>
            <span>
              <MessageCircle size={15} /> WhatsApp orders
            </span>
            <span>
              <Store size={15} /> Online storefront
            </span>
            <span>
              <CreditCard size={15} /> Payments
            </span>
            <span>
              <Users size={15} /> Customers
            </span>
          </div>
        </div>
      </section>
      <section className="section section-white">
        <div className="container">
          <SectionHeading
            eyebrow="THE EVERYDAY PROBLEM"
            title="You started a business. Not a full-time admin job."
            body="Selling through WhatsApp works — until orders pile up, customers follow up and you can't remember who has paid."
            center
          />
          <div className="problem-grid">
            <div className="problem-card">
              <span className="problem-number">01</span>
              <MessageCircle />
              <h3>Orders get buried</h3>
              <p>A customer's order disappears between chats, voice notes and status replies.</p>
            </div>
            <div className="problem-card">
              <span className="problem-number">02</span>
              <FileText />
              <h3>Details get forgotten</h3>
              <p>Names, quantities, addresses and payment records end up scattered everywhere.</p>
            </div>
            <div className="problem-card">
              <span className="problem-number">03</span>
              <Wallet />
              <h3>Money gets confusing</h3>
              <p>Part-payments and unpaid balances are hard to follow when they're only in a notebook.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="section section-soft">
        <div className="container">
          <div className="feature-intro">
            <SectionHeading
              eyebrow="MEET YOUR NEW WORKSPACE"
              title="The small-business tools that make a big difference."
              body="SellSharp gives your business a proper home — from the first customer click to the final receipt."
            />
          </div>
          <div className="feature-grid">
            {HOME_FEATURES.map(({ icon: Icon, title, text }, i) => (
              <div className="feature-card" key={title}>
                <span className="feature-icon">
                  <Icon size={20} />
                </span>
                <span className="feature-index">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="center-action">
            <Link to="/features" className="btn btn-outline">
              Explore all features <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section section-white">
        <div className="container split-section">
          <div className="split-copy">
            <span className="eyebrow">YOUR STORE. YOUR LINK.</span>
            <h2>Give customers one place to find everything you sell.</h2>
            <p>
              Set up your storefront once. Add your products, share your link on WhatsApp, Instagram or anywhere your
              customers find you.
            </p>
            <ul className="check-list">
              <li>
                <CheckCircle2 /> A clean page for your products
              </li>
              <li>
                <CheckCircle2 /> Simple checkout for your customers
              </li>
              <li>
                <CheckCircle2 /> New orders appear in your dashboard
              </li>
              <li>
                <CheckCircle2 /> Your business name and identity front and centre
              </li>
            </ul>
            <Link to="/features" className="text-link">
              Take a closer look <ArrowRight size={16} />
            </Link>
          </div>
          <div className="store-preview">
            <div className="store-browser">
              <span />
              <span />
              <span />
              <small>sellsharp.ng/ama-hairs</small>
            </div>
            <div className="store-cover">
              <div className="store-logo">A.</div>
              <span>AMA HAIR STUDIO</span>
              <h3>
                Find your
                <br />
                next favourite.
              </h3>
              <p>Quality hair. Confidence in every look.</p>
            </div>
            <div className="store-products">
              <div>
                <div className="product-img product-one"> </div>
                <b>Silky Straight Wig</b>
                <span>₦45,000</span>
              </div>
              <div>
                <div className="product-img product-two"> </div>
                <b>Body Wave Bundle</b>
                <span>₦32,000</span>
              </div>
              <div>
                <div className="product-img product-three"> </div>
                <b>Luxury Closure</b>
                <span>₦18,500</span>
              </div>
            </div>
            <div className="store-bottom">
              <span>
                <ShieldCheck size={14} /> Secure checkout
              </span>
              <span>
                <MessageCircle size={14} /> Chat with seller
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="section section-dark">
        <div className="container pricing-band">
          <div>
            <span className="eyebrow eyebrow-light">SIMPLE, STRAIGHTFORWARD PRICING</span>
            <h2>One plan. Everything you need to get organised.</h2>
            <p>No complicated tiers. No surprise add-ons. Just the tools to run your store with more confidence.</p>
          </div>
          <div className="price-panel">
            <span className="price-label">SELLSHARP MONTHLY</span>
            <div className="price-amount">
              ₦3,000 <small>/ month</small>
            </div>
            <p>All the essentials for your growing business.</p>
            <Link to="/pricing" className="btn btn-white">
              See what's included <ArrowRight size={16} />
            </Link>
            <small className="price-note">Cancel anytime. Your business data stays yours.</small>
          </div>
        </div>
      </section>
      <section className="section section-white">
        <div className="container final-cta">
          <span className="eyebrow">READY WHEN YOU ARE</span>
          <h2>Make room for more business.</h2>
          <p>Spend less time keeping track of everything — and more time doing what you do best.</p>
          <Link to="/signup" className="btn btn-primary btn-large">
            Get started with SellSharp <ArrowRight size={17} />
          </Link>
          <small>Simple setup. Your own store link. One place to manage it all.</small>
        </div>
      </section>
    </>
  );
}
