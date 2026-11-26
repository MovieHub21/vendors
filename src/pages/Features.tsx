import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { InteractivePlatformDemo } from "../components/InteractivePlatformDemo";
import { FEATURE_PAGE_ITEMS } from "../data/features";
import { PAGE_META } from "../data/pageMeta";
import { crumbs } from "../lib/crumbs";
import { breadcrumbJsonLd } from "../lib/seo";

export default function Features() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.features, jsonLd: [breadcrumbJsonLd(crumbs(PAGE_META.features))] }} />

      {/* Page Hero */}
      <PageHero
        eyebrow="HOW IT WORKS &amp; COMPLETE PLATFORM DEMO"
        title={
          <>
            See everything you get
            <br />
            <em>before you spend 1 kobo.</em>
          </>
        }
        body="Sellsharp gives Nigerian social media and WhatsApp sellers an organized online storefront, inventory manager, point-of-sale debt tracker, and branded digital receipts — for ₦100/month during our live payment test."
      />

      {/* Main Interactive Desktop Demo Section */}
      <section className="section section-white demo-section-wrapper">
        <div className="container">
          <InteractivePlatformDemo />
        </div>
      </section>

      {/* 3-Step Simple How It Works Section */}
      <section className="section section-soft how-it-works-steps-section">
        <div className="container">
          <div className="section-head text-center">
            <span className="eyebrow">SIMPLE 3-STEP PROCESS</span>
            <h2>How Sellsharp Works For Your Business</h2>
            <p className="section-lead">
              No technical knowledge needed. If you can use WhatsApp and Instagram, you can run your Sellsharp store with ease.
            </p>
          </div>

          <div className="steps-cards-grid">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-badge">STEP 01</div>
              <div className="step-icon-wrap">
                <Store size={26} className="text-accent" />
              </div>
              <h3>Create Your Store in 5 Minutes</h3>
              <p>
                Sign up, choose your custom link (e.g. <code>sellsharp.ng/yourname</code>), add your WhatsApp number, and upload product photos with prices and descriptions.
              </p>
              <ul className="step-features-list">
                <li><Check size={14} className="text-green" /> Automatic multi-photo compression</li>
                <li><Check size={14} className="text-green" /> Customizable banner and business bio</li>
                <li><Check size={14} className="text-green" /> Add bank details for customer transfers</li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-badge">STEP 02</div>
              <div className="step-icon-wrap">
                <MessageCircle size={26} className="text-green" />
              </div>
              <h3>Put Your Link in Bio &amp; Status</h3>
              <p>
                Paste your store link on your Instagram bio, TikTok profile, and WhatsApp status. Instead of sending 50 photos individually to every customer, they browse your full catalog 24/7.
              </p>
              <ul className="step-features-list">
                <li><Check size={14} className="text-green" /> Fast loading on all smartphones &amp; laptops</li>
                <li><Check size={14} className="text-green" /> Customers add items to cart with one tap</li>
                <li><Check size={14} className="text-green" /> Orders forward cleanly to your WhatsApp DM</li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-badge">STEP 03</div>
              <div className="step-icon-wrap">
                <Wallet size={26} className="text-purple" />
              </div>
              <h3>Confirm Orders, Track Debts &amp; Issue Receipts</h3>
              <p>
                When a customer orders, confirm payment, record sales, track balances if they pay in installments, and send them a professional branded WhatsApp PDF receipt.
              </p>
              <ul className="step-features-list">
                <li><Check size={14} className="text-green" /> Instant stock reduction when sales happen</li>
                <li><Check size={14} className="text-green" /> Automatic debt reminders for partial payments</li>
                <li><Check size={14} className="text-green" /> Keep 100% of your money (0% commission)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table: The Old Way vs The Sellsharp Way */}
      <section className="section section-white comparison-section">
        <div className="container">
          <div className="section-head text-center">
            <span className="eyebrow">WHY VENDORS SWITCH</span>
            <h2>Selling in DMs Chaos vs. Running on Sellsharp</h2>
            <p className="section-lead">
              See why hundreds of Nigerian vendors save hours of daily frustration by switching to Sellsharp.
            </p>
          </div>

          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Business Workflow</th>
                  <th className="th-old">Selling Without Sellsharp (DM Chaos)</th>
                  <th className="th-new">Selling With Sellsharp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Showing Products</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Scrolling your phone gallery to send 40 heavy photos every time a buyer asks "What do you have?"</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span>Send one neat link: <code>sellsharp.ng/yourname</code>. Customers browse categories and prices instantly.</span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Customer Ordering</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Scattered chat screenshots, typing prices over and over, lost order addresses in old chats.</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span>Buyer adds to cart, fills name, phone, delivery address, and sends neatly formatted order to your WhatsApp.</span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Stock &amp; Inventory</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Guessing what is left in stock, accidentally selling items that are already out of stock.</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span>Automatic stock count countdown. Out-of-stock items are marked clearly so you never oversell.</span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Debt &amp; Part-Payments</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Writing debts in paper notebooks, forgetting who owes what, and awkward payment reminders.</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span>Debt Tracker keeps exact balance per customer with 1-click friendly WhatsApp reminder generation.</span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Receipts &amp; Professionalism</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Typing manual bank transfer text or using phone notes that look unprofessional.</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span>Generates branded digital receipts with your logo, receipt number, bank details, and warranty notes.</span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Transaction Fees</strong></td>
                  <td className="td-old">
                    <XCircle size={15} className="icon-bad" />
                    <span>Some platforms take 5% to 15% cut on every single product you sell.</span>
                  </td>
                  <td className="td-new">
                    <CheckCircle2 size={15} className="icon-good" />
                    <span><strong>0% commission.</strong> ₦100/month during our live payment test. Every naira you make is 100% yours.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detailed Feature Cards Grid */}
      <section className="section section-soft">
        <div className="container">
          <div className="section-head text-center">
            <span className="eyebrow">COMPREHENSIVE TOOLKIT</span>
            <h2>Everything Included In Your ₦100 Test Plan</h2>
            <p className="section-lead">
              No hidden tiers or locked features. When you subscribe, every tool is unlocked immediately.
            </p>
          </div>

          <div className="feature-page-grid">
            {FEATURE_PAGE_ITEMS.map(({ icon: Icon, title, text }, i) => (
              <article className="feature-page-card" key={title}>
                <div className="feature-page-top">
                  <span className="feature-icon">
                    <Icon size={21} />
                  </span>
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Live Storefront Showcase Banner */}
      <section className="section section-white live-demo-cta-strip">
        <div className="container">
          <div className="live-demo-box">
            <div className="live-demo-copy">
              <span className="eyebrow">TRY A LIVE STORE</span>
              <h2>Want to test an actual store as a shopper?</h2>
              <p>
                Visit <strong>Webdev Gadgets</strong>, add products to your cart, and see how simple the shopping experience is for your customers.
              </p>
            </div>
            <div className="live-demo-buttons">
              <a
                href="/webdev"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-large"
              >
                Open Webdev Demo Store <ExternalLink size={16} />
              </a>
              <Link to="/signup" className="btn btn-primary btn-large">
                Create your store now <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Conversion CTA */}
      <section className="section section-soft">
        <div className="container final-cta">
          <span className="eyebrow">START TODAY</span>
          <h2>Ready to give your business a proper home?</h2>
          <p>Join hundreds of smart Nigerian sellers organizing their sales, orders, and debts with Sellsharp.</p>
          <div className="final-cta-buttons">
            <Link to="/signup" className="btn btn-primary btn-large">
              Create your store for ₦100/mo during our live payment test <ArrowRight size={17} />
            </Link>
            <Link to="/pricing" className="btn btn-quiet">
              Review pricing details
            </Link>
          </div>
          <small className="muted" style={{ display: "block", marginTop: "16px" }}>
            Cancel anytime · No transaction commission · Set up in 5 minutes
          </small>
        </div>
      </section>
    </>
  );
}
