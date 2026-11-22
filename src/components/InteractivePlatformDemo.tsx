import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatNaira } from "../lib/money";

type DemoTab = "storefront" | "dashboard" | "sale" | "products" | "receipt" | "seo";

const TABS: { id: DemoTab; label: string; badge: string; icon: any }[] = [
  { id: "storefront", label: "Customer Storefront", badge: "webdev", icon: Store },
  { id: "dashboard", label: "Vendor Dashboard", badge: "Live Analytics", icon: BarChart3 },
  { id: "sale", label: "Record Sale & Debts", badge: "CRM & Pos", icon: Wallet },
  { id: "products", label: "Product Inventory", badge: "Catalog", icon: Package },
  { id: "receipt", label: "Branded Receipts", badge: "WhatsApp PDF", icon: FileText },
  { id: "seo", label: "Google Search (SEO)", badge: "Discoverability", icon: Globe },
];

export function InteractivePlatformDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("storefront");
  const [cartCount, setCartCount] = useState(1);
  const [saleType, setSaleType] = useState<"paid" | "part" | "unpaid">("part");

  return (
    <div className="platform-demo-wrap">
      {/* Header explanation banner */}
      <div className="demo-header-banner">
        <div className="demo-header-badge">
          <span>LIVE PLATFORM PREVIEW · DESKTOP SUITE</span>
        </div>
        <h2>What You Get With Sellsharp</h2>
        <p>
          Explore the exact screens, tools, and storefront you receive the moment you activate your store.
          Below is a live interactive preview of <strong>Webdev</strong> (a real gadget store built on Sellsharp).
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="demo-tabs-bar" role="tablist" aria-label="Select platform demo view">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`demo-tab-btn ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="demo-tab-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="demo-tab-text">
                <strong>{tab.label}</strong>
                <small>{tab.badge}</small>
              </span>
              {isActive && <span className="demo-tab-active-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* Desktop Browser Window Mockup */}
      <div className="demo-browser-frame">
        {/* Browser Top Chrome */}
        <div className="browser-chrome">
          <div className="browser-dots" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>

          <div className="browser-nav-btns" aria-hidden="true">
            <button type="button" tabIndex={-1}>‹</button>
            <button type="button" tabIndex={-1}>›</button>
            <button type="button" tabIndex={-1}><RefreshCw size={11} /></button>
          </div>

          <div className="browser-address-bar">
            <Lock size={12} className="lock-icon" aria-hidden="true" />
            <span className="address-domain">sellsharp.ng</span>
            <span className="address-path">
              {activeTab === "storefront" && "/webdev"}
              {activeTab === "dashboard" && "/dashboard"}
              {activeTab === "sale" && "/dashboard/sale"}
              {activeTab === "products" && "/dashboard/products"}
              {activeTab === "receipt" && "/dashboard/receipt/REC-0042"}
              {activeTab === "seo" && "/dashboard/seo"}
            </span>
          </div>

          <div className="browser-right-actions">
            {activeTab === "storefront" ? (
              <a
                href="/webdev"
                target="_blank"
                rel="noopener noreferrer"
                className="browser-open-link"
                title="Open live Webdev store in new tab"
              >
                <span>Open live store</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : (
              <span className="browser-badge-pill">Desktop Dashboard</span>
            )}
          </div>
        </div>

        {/* Browser Content Stage */}
        <div className="browser-viewport">
          {/* SCREEN 1: STOREFRONT */}
          {activeTab === "storefront" && (
            <div className="screen-storefront">
              {/* Storefront Navigation Bar */}
              <div className="demo-sf-navbar">
                <div className="demo-sf-brand">
                  <div className="demo-sf-logo-placeholder">W</div>
                  <div>
                    <strong>Webdev</strong>
                    <span className="demo-sf-tag">PHONES &amp; GADGETS · BENIN CITY</span>
                  </div>
                </div>

                <div className="demo-sf-nav-links">
                  <span className="sf-link active">Shop</span>
                  <span className="sf-link">About</span>
                  <button
                    type="button"
                    className="demo-sf-cart-btn"
                    onClick={() => setCartCount((c) => (c === 0 ? 1 : c + 1))}
                  >
                    <ShoppingCart size={14} />
                    <span>Cart</span>
                    <span className="demo-sf-badge">{cartCount}</span>
                  </button>
                  <a
                    href="https://wa.me/2348117051415"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="demo-sf-chat-btn"
                  >
                    <MessageCircle size={14} />
                    <span>Chat with seller</span>
                  </a>
                </div>
              </div>

              {/* Storefront Hero Banner */}
              <div className="demo-sf-hero">
                <div className="demo-sf-hero-overlay" />
                <div className="demo-sf-hero-content">
                  <span className="demo-sf-eyebrow">PREMIUM TECH · FAST NATIONWIDE DELIVERY</span>
                  <h1>Find Your Best Gadget With Us</h1>
                  <p>Phones, Laptops, Earpods, and other Gadgets From Marvel Tech.</p>
                  <div className="demo-sf-hero-actions">
                    <a href="#demo-products" className="demo-sf-cta-btn">
                      Shop collection <span>→</span>
                    </a>
                    <span className="demo-sf-seller-verified">
                      <ShieldCheck size={14} />
                      Verified Nigerian Merchant
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="demo-sf-cat-bar">
                <span className="demo-sf-cat-pill active">All Gadgets (3)</span>
                <span className="demo-sf-cat-pill">Smartphones (2)</span>
                <span className="demo-sf-cat-pill">Apple Mac (1)</span>
                <span className="demo-sf-cat-pill">Audio &amp; Accessories</span>
              </div>

              {/* Product Grid */}
              <div id="demo-products" className="demo-sf-products-grid">
                {/* Product 1 */}
                <div className="demo-sf-product-card">
                  <div className="demo-sf-img-wrap">
                    <img
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRB0AXARomq_C1g-NX2QJ3U399tDC3apJz86SXw1uplQQ&s=10"
                      alt="iPhone 17 Pro Max"
                    />
                    <span className="demo-sf-tag-new">Best Seller</span>
                  </div>
                  <div className="demo-sf-card-body">
                    <small>SMARTPHONES</small>
                    <h3>iPhone 17 Pro Max</h3>
                    <p>Brand new iPhone 17 Pro Max available for sale in Benin City, Edo State.</p>
                    <div className="demo-sf-card-foot">
                      <strong className="demo-sf-price">₦2,000,000</strong>
                      <button
                        type="button"
                        className="demo-sf-buy-btn"
                        onClick={() => setCartCount((c) => c + 1)}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product 2 */}
                <div className="demo-sf-product-card">
                  <div className="demo-sf-img-wrap">
                    <img
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShFxLDod6YCeohCiJxsOMOxisvA4RP4Mm69NQPKCmP3g&s=10"
                      alt="iPhone Duo"
                    />
                    <span className="demo-sf-tag-featured">Trending</span>
                  </div>
                  <div className="demo-sf-card-body">
                    <small>SMARTPHONES</small>
                    <h3>iPhone Duo</h3>
                    <p>iPhone 18 Duo, brand new in factory sealed box with 1-year warranty.</p>
                    <div className="demo-sf-card-foot">
                      <strong className="demo-sf-price">₦3,800,000</strong>
                      <button
                        type="button"
                        className="demo-sf-buy-btn"
                        onClick={() => setCartCount((c) => c + 1)}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product 3 */}
                <div className="demo-sf-product-card">
                  <div className="demo-sf-img-wrap">
                    <img
                      src="https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/mac-studio-chip-unselect-202601-gallery-1_FMT_WHH?wid=690&hei=720&fmt=jpeg&qlt=90&.v=1767380422829"
                      alt="Mac Studio"
                    />
                    <span className="demo-sf-tag-pro">Powerhouse</span>
                  </div>
                  <div className="demo-sf-card-body">
                    <small>COMPUTING</small>
                    <h3>Mac Studio</h3>
                    <p>128 cores, 256GB unified memory, ultimate workstation for creators.</p>
                    <div className="demo-sf-card-foot">
                      <strong className="demo-sf-price">₦7,000,000</strong>
                      <button
                        type="button"
                        className="demo-sf-buy-btn"
                        onClick={() => setCartCount((c) => c + 1)}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Annotation callouts */}
              <div className="demo-feature-callout">
                <div className="callout-pill">
                  <Check size={14} /> <span>Your own professional link (sellsharp.ng/yourname)</span>
                </div>
                <div className="callout-pill">
                  <Check size={14} /> <span>Customers order directly into your WhatsApp</span>
                </div>
                <div className="callout-pill">
                  <Check size={14} /> <span>0% transaction fee — keep 100% of your money</span>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: VENDOR DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="screen-dashboard">
              {/* Dashboard Topbar */}
              <div className="dash-demo-topbar">
                <div className="dash-demo-topbar-left">
                  <img src="/logo-icon.jpg" alt="Sellsharp" className="dash-demo-logo" />
                  <span className="dash-demo-store-name">Webdev Workspace</span>
                  <span className="dash-demo-live-badge">
                    <span className="live-pulse" /> Store is live
                  </span>
                </div>
                <div className="dash-demo-topbar-right">
                  <button type="button" className="dash-demo-btn-sm" onClick={() => setActiveTab("sale")}>
                    <Plus size={13} /> Record Sale
                  </button>
                  <a href="/webdev" target="_blank" rel="noopener noreferrer" className="dash-demo-btn-outline">
                    View Store <ExternalLink size={12} />
                  </a>
                  <div className="dash-demo-avatar">W</div>
                </div>
              </div>

              {/* 4 Stat Tiles */}
              <div className="dash-demo-stats-grid">
                <div className="dash-stat-card">
                  <div className="stat-card-head">
                    <span>TOTAL SALES THIS MONTH</span>
                    <TrendingUp size={15} className="stat-icon-green" />
                  </div>
                  <strong>₦12,800,000</strong>
                  <small className="stat-sub-green">↑ 24% from last month · 18 orders</small>
                </div>

                <div className="dash-stat-card">
                  <div className="stat-card-head">
                    <span>CONFIRMED ORDERS</span>
                    <ShoppingBag size={15} className="stat-icon-blue" />
                  </div>
                  <strong>18 Orders</strong>
                  <small className="stat-sub-blue">All fulfilled · 0 disputes</small>
                </div>

                <div className="dash-stat-card">
                  <div className="stat-card-head">
                    <span>CUSTOMER BASE</span>
                    <Users size={15} className="stat-icon-purple" />
                  </div>
                  <strong>14 Buyers</strong>
                  <small className="stat-sub-purple">6 repeat customers (42%)</small>
                </div>

                <div className="dash-stat-card stat-debt-highlight">
                  <div className="stat-card-head">
                    <span>UNPAID DEBTS (OWED TO YOU)</span>
                    <Clock size={15} className="stat-icon-orange" />
                  </div>
                  <strong className="stat-debt-amt">₦350,000</strong>
                  <small className="stat-sub-orange">2 customers with balances</small>
                </div>
              </div>

              {/* Main Content Split: Recent Sales & Quick Debt Reminders */}
              <div className="dash-demo-two-col">
                <div className="dash-demo-panel">
                  <div className="panel-header">
                    <h3>Recent Sales Stream</h3>
                    <button type="button" className="panel-link" onClick={() => setActiveTab("sale")}>
                      View all sales →
                    </button>
                  </div>
                  <div className="sales-stream-list">
                    <div className="sale-item">
                      <div className="sale-item-avatar">CO</div>
                      <div className="sale-item-info">
                        <strong>Chidinma Okafor</strong>
                        <small>iPhone 17 Pro Max · Today, 2:15 PM</small>
                      </div>
                      <div className="sale-item-money">
                        <strong>₦2,000,000</strong>
                        <span className="badge badge-paid">Paid in full</span>
                      </div>
                    </div>

                    <div className="sale-item">
                      <div className="sale-item-avatar">EK</div>
                      <div className="sale-item-info">
                        <strong>Emeka Kalu</strong>
                        <small>Mac Studio 128-core · Yesterday</small>
                      </div>
                      <div className="sale-item-money">
                        <strong>₦7,000,000</strong>
                        <span className="badge badge-paid">Bank Transfer</span>
                      </div>
                    </div>

                    <div className="sale-item">
                      <div className="sale-item-avatar">SE</div>
                      <div className="sale-item-info">
                        <strong>Sandra Efe</strong>
                        <small>iPhone Duo · Nov 19</small>
                      </div>
                      <div className="sale-item-money">
                        <strong>₦3,800,000</strong>
                        <span className="badge badge-part">₦300k Owed</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dash-demo-panel">
                  <div className="panel-header">
                    <h3>Active Debt Tracker</h3>
                    <span className="badge badge-warning">2 Active Debts</span>
                  </div>
                  <p className="panel-subtext">
                    Sellsharp automatically remembers who owes you money and lets you send gentle WhatsApp reminders in 1 click.
                  </p>
                  <div className="debt-card-mini">
                    <div className="debt-card-top">
                      <div>
                        <strong>Sandra Efe</strong>
                        <small>Phone: 0803 112 4499</small>
                      </div>
                      <span className="debt-amt-tag">Owes ₦300,000</span>
                    </div>
                    <div className="debt-progress-bar">
                      <div className="debt-progress-fill" style={{ width: "92%" }} />
                    </div>
                    <div className="debt-card-foot">
                      <small>Paid: ₦3,500,000 of ₦3,800,000</small>
                      <button
                        type="button"
                        className="btn-whatsapp-sm"
                        onClick={() => alert("Simulated: WhatsApp payment reminder generated with bank details.")}
                      >
                        <MessageCircle size={12} /> Send reminder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: RECORD SALE & DEBTS */}
          {activeTab === "sale" && (
            <div className="screen-sale">
              <div className="sale-demo-container">
                <div className="sale-demo-left">
                  <div className="sale-demo-card">
                    <h2>Record a Sale / Point of Sale</h2>
                    <p className="muted">Record sales in 10 seconds. Keeps stock in sync and tracks who has paid or owes balance.</p>

                    <div className="demo-field-group">
                      <label>Customer Name or Phone Number</label>
                      <div className="demo-customer-selected">
                        <div className="demo-cust-icon">👤</div>
                        <div className="demo-cust-details">
                          <strong>Chidinma Okafor</strong>
                          <small>0802 345 6789 · Benin City, Edo · Returning Buyer (3 past orders)</small>
                        </div>
                        <span className="demo-cust-tag">Matched Customer</span>
                      </div>
                    </div>

                    <div className="demo-field-group">
                      <label>Selected Items</label>
                      <div className="demo-sale-line-item">
                        <div className="item-icon">📱</div>
                        <div className="item-name">
                          <strong>iPhone 17 Pro Max (Brand New)</strong>
                          <small>Unit price: ₦2,000,000 · Stock remaining: 4</small>
                        </div>
                        <div className="item-qty">Qty: 1</div>
                        <div className="item-total">₦2,000,000</div>
                      </div>
                    </div>

                    <div className="demo-field-group">
                      <label>Payment Method &amp; Status</label>
                      <div className="payment-seg-control">
                        <button
                          type="button"
                          className={saleType === "paid" ? "on" : ""}
                          onClick={() => setSaleType("paid")}
                        >
                          Paid in Full
                        </button>
                        <button
                          type="button"
                          className={saleType === "part" ? "on" : ""}
                          onClick={() => setSaleType("part")}
                        >
                          Part-Payment (Debt)
                        </button>
                        <button
                          type="button"
                          className={saleType === "unpaid" ? "on" : ""}
                          onClick={() => setSaleType("unpaid")}
                        >
                          Unpaid (Full Debt)
                        </button>
                      </div>
                    </div>

                    {saleType === "part" && (
                      <div className="demo-debt-inputs">
                        <div className="debt-input-col">
                          <label>Amount Paid Now (₦)</label>
                          <input type="text" readOnly value="1,500,000" />
                        </div>
                        <div className="debt-input-col">
                          <label>Remaining Balance (Owed)</label>
                          <input type="text" readOnly value="500,000" className="debt-highlight-input" />
                        </div>
                      </div>
                    )}

                    <div className="demo-sale-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setActiveTab("receipt")}
                      >
                        Confirm Sale &amp; View Branded Receipt →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sale-demo-right">
                  <div className="sale-summary-card">
                    <h3>Sale Summary</h3>
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <strong>₦2,000,000</strong>
                    </div>
                    <div className="summary-row">
                      <span>Amount Received:</span>
                      <strong className="text-green">
                        {saleType === "paid" && "₦2,000,000"}
                        {saleType === "part" && "₦1,500,000"}
                        {saleType === "unpaid" && "₦0"}
                      </strong>
                    </div>
                    <div className="summary-row summary-balance-row">
                      <span>Balance Outstanding:</span>
                      <strong className={saleType !== "paid" ? "text-red" : "text-gray"}>
                        {saleType === "paid" && "₦0 (Settled)"}
                        {saleType === "part" && "₦500,000 (Owed)"}
                        {saleType === "unpaid" && "₦2,000,000 (Owed)"}
                      </strong>
                    </div>

                    <div className="summary-benefits">
                      <h4>What happens when you click Confirm:</h4>
                      <ul>
                        <li><Check size={13} /> Stock quantity drops from 5 to 4 automatically.</li>
                        <li><Check size={13} /> Chidinma's customer profile is updated with this purchase.</li>
                        <li><Check size={13} /> Digital receipt is created ready to send to WhatsApp.</li>
                        {saleType !== "paid" && (
                          <li><Check size={13} /> ₦500,000 is logged to your Debt Tracker with 1-click reminders.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: PRODUCT & INVENTORY */}
          {activeTab === "products" && (
            <div className="screen-products">
              <div className="prod-demo-header">
                <div>
                  <h2>Product Inventory Catalog (3)</h2>
                  <p className="muted">Manage your pictures, prices, descriptions, and stock quantities.</p>
                </div>
                <button type="button" className="btn btn-primary btn-small">
                  <Plus size={14} /> Add new product
                </button>
              </div>

              <div className="prod-demo-table">
                <div className="prod-row-header">
                  <span>PRODUCT &amp; COVER PHOTO</span>
                  <span>CATEGORY</span>
                  <span>PRICE</span>
                  <span>INVENTORY</span>
                  <span>STORE STATUS</span>
                </div>

                <div className="prod-row">
                  <div className="prod-info-cell">
                    <img
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRB0AXARomq_C1g-NX2QJ3U399tDC3apJz86SXw1uplQQ&s=10"
                      alt="iPhone 17 Pro Max"
                      className="prod-thumb"
                    />
                    <div>
                      <strong>iPhone 17 Pro Max</strong>
                      <small>2 pictures · Auto-compressed for fast loading</small>
                    </div>
                  </div>
                  <div><span className="badge badge-light">Phones</span></div>
                  <div><strong>₦2,000,000</strong></div>
                  <div><span className="badge badge-stock">4 in stock</span></div>
                  <div><span className="badge badge-published">● Visible in Store</span></div>
                </div>

                <div className="prod-row">
                  <div className="prod-info-cell">
                    <img
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShFxLDod6YCeohCiJxsOMOxisvA4RP4Mm69NQPKCmP3g&s=10"
                      alt="iPhone Duo"
                      className="prod-thumb"
                    />
                    <div>
                      <strong>iPhone Duo (Brand New)</strong>
                      <small>1 picture · Factory sealed</small>
                    </div>
                  </div>
                  <div><span className="badge badge-light">Phones</span></div>
                  <div><strong>₦3,800,000</strong></div>
                  <div><span className="badge badge-stock">2 in stock</span></div>
                  <div><span className="badge badge-published">● Visible in Store</span></div>
                </div>

                <div className="prod-row">
                  <div className="prod-info-cell">
                    <img
                      src="https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/mac-studio-chip-unselect-202601-gallery-1_FMT_WHH?wid=690&hei=720&fmt=jpeg&qlt=90&.v=1767380422829"
                      alt="Mac Studio"
                      className="prod-thumb"
                    />
                    <div>
                      <strong>Mac Studio 128-core</strong>
                      <small>1 picture · Workstation</small>
                    </div>
                  </div>
                  <div><span className="badge badge-light">Laptops &amp; Macs</span></div>
                  <div><strong>₦7,000,000</strong></div>
                  <div><span className="badge badge-stock">1 in stock</span></div>
                  <div><span className="badge badge-published">● Visible in Store</span></div>
                </div>
              </div>

              <div className="prod-demo-features-grid">
                <div className="prod-feat-card">
                  <span className="feat-icon">📷</span>
                  <strong>Multi-Photo Upload</strong>
                  <p>Upload several pictures at once. Sellsharp automatically compresses high-res photos so pages load lightning fast.</p>
                </div>
                <div className="prod-feat-card">
                  <span className="feat-icon">📉</span>
                  <strong>Automatic Stock Sync</strong>
                  <p>Whenever you record a sale, the stock quantity decreases automatically. You never accidentally sell what is finished.</p>
                </div>
                <div className="prod-feat-card">
                  <span className="feat-icon">🔗</span>
                  <strong>Direct Product Links</strong>
                  <p>Share direct links to individual products (e.g. <code>sellsharp.ng/webdev/iphone-17-pro-max</code>) on your WhatsApp status.</p>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: DIGITAL RECEIPTS & INVOICES */}
          {activeTab === "receipt" && (
            <div className="screen-receipt">
              <div className="receipt-demo-split">
                <div className="receipt-paper">
                  {/* Receipt Header */}
                  <div className="receipt-head">
                    <div className="receipt-store-logo">W</div>
                    <div className="receipt-store-meta">
                      <h2>WEBDEV ENTERPRISES</h2>
                      <p>Phones, Laptops &amp; Gadgets · Benin City, Edo</p>
                      <small>Phone: +234 811 705 1415 · support@webdev.ng</small>
                    </div>
                    <div className="receipt-badge-status">PAID IN FULL</div>
                  </div>

                  <div className="receipt-divider" />

                  {/* Receipt Meta */}
                  <div className="receipt-meta-grid">
                    <div>
                      <small>BILLED TO</small>
                      <strong>Chidinma Okafor</strong>
                      <p>Benin City, Edo State</p>
                    </div>
                    <div>
                      <small>RECEIPT NUMBER</small>
                      <strong>#REC-0042</strong>
                      <p>Date: Nov 22, 2026</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="receipt-table">
                    <thead>
                      <tr>
                        <th>ITEM</th>
                        <th>QTY</th>
                        <th>UNIT PRICE</th>
                        <th>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>iPhone 17 Pro Max</strong>
                          <small>Factory sealed · 1-year warranty</small>
                        </td>
                        <td>1</td>
                        <td>₦2,000,000</td>
                        <td>₦2,000,000</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="receipt-divider" />

                  {/* Calculation summary */}
                  <div className="receipt-totals-area">
                    <div className="receipt-calc-row">
                      <span>Subtotal:</span>
                      <strong>₦2,000,000</strong>
                    </div>
                    <div className="receipt-calc-row">
                      <span>Amount Paid (Bank Transfer):</span>
                      <strong className="text-green">₦2,000,000</strong>
                    </div>
                    <div className="receipt-calc-row receipt-grand-total">
                      <span>Balance Outstanding:</span>
                      <strong>₦0</strong>
                    </div>
                  </div>

                  {/* Bank Details note */}
                  <div className="receipt-bank-box">
                    <small>OFFICIAL PAYMENT ACCOUNT</small>
                    <strong>Zenith Bank · 1234567890 · Webdev Enterprises</strong>
                    <p>Thank you for your patronage! Please retain this receipt for warranty claims.</p>
                  </div>
                </div>

                <div className="receipt-actions-side">
                  <div className="dash-card">
                    <h3>WhatsApp-Ready Receipts</h3>
                    <p className="muted">
                      Customers love receiving neat, professional receipts on WhatsApp instead of messy typed messages.
                    </p>
                    <div className="receipt-action-buttons">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => alert("Simulated: Branded PDF receipt downloaded.")}
                      >
                        <FileText size={15} /> Download PDF Receipt
                      </button>
                      <button
                        type="button"
                        className="btn btn-whatsapp"
                        onClick={() => alert("Simulated: WhatsApp receipt link shared.")}
                      >
                        <MessageCircle size={15} /> Share to Customer WhatsApp
                      </button>
                    </div>
                    <hr style={{ margin: "20px 0", borderColor: "var(--color-line)" }} />
                    <div className="receipt-checklist">
                      <div className="check-item">
                        <CheckCircle2 size={16} className="text-green" />
                        <span>Includes your store logo, name &amp; bank details</span>
                      </div>
                      <div className="check-item">
                        <CheckCircle2 size={16} className="text-green" />
                        <span>Sequential receipt numbering (never duplicates)</span>
                      </div>
                      <div className="check-item">
                        <CheckCircle2 size={16} className="text-green" />
                        <span>Customizable layout designer in dashboard</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 6: GOOGLE SEARCH (SEO) */}
          {activeTab === "seo" && (
            <div className="screen-seo">
              <div className="seo-demo-container">
                <div className="seo-search-engine-box">
                  <div className="google-top-bar">
                    <span className="google-logo">
                      <span style={{ color: "#4285F4" }}>G</span>
                      <span style={{ color: "#EA4335" }}>o</span>
                      <span style={{ color: "#FBBC05" }}>o</span>
                      <span style={{ color: "#4285F4" }}>g</span>
                      <span style={{ color: "#34A853" }}>l</span>
                      <span style={{ color: "#EA4335" }}>e</span>
                    </span>
                    <div className="google-fake-search">
                      <Search size={14} className="text-muted" />
                      <span>buy iphone 17 pro max in benin city</span>
                    </div>
                  </div>

                  <div className="google-serp-result">
                    <div className="serp-breadcrumbs">
                      <img src="/logo-icon.jpg" alt="" className="serp-favicon" />
                      <span>sellsharp.ng › webdev</span>
                    </div>
                    <h3 className="serp-title">
                      Webdev — Find Your Best Gadget With Us | iPhone &amp; Laptops in Benin City
                    </h3>
                    <p className="serp-snippet">
                      Shop brand new iPhone 17 Pro Max, iPhone Duo, and Mac Studio at Webdev. Located in Benin City, Edo State. Browse our verified online store and order directly on WhatsApp.
                    </p>
                    <div className="serp-sitelinks">
                      <span>Shop Gadgets</span> · <span>About Webdev</span> · <span>Contact Seller</span>
                    </div>
                  </div>
                </div>

                <div className="seo-benefits-panel">
                  <div className="dash-card">
                    <h3>How Sellsharp Gets You Discovered</h3>
                    <p className="muted">
                      Every Sellsharp store is built with automatic Search Engine Optimization (SEO). Buyers in your city searching on Google find your store without paying for expensive ads.
                    </p>
                    <ul className="seo-points-list">
                      <li>
                        <strong>Automatic XML Sitemaps:</strong>
                        <span>Submitted automatically to Google and Bing so every product is indexed.</span>
                      </li>
                      <li>
                        <strong>City &amp; State Geolocation:</strong>
                        <span>Links your store to your location (e.g. Benin City, Lagos, Abuja) to rank for local buyers.</span>
                      </li>
                      <li>
                        <strong>Rich WhatsApp Previews:</strong>
                        <span>When you share links on WhatsApp or Instagram, beautiful title and image cards appear automatically.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
