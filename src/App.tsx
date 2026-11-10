import { useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Check, CheckCircle2,
  ChevronDown, CircleHelp, ClipboardList, CreditCard, FileText, Menu,
  MessageCircle, Package, ShieldCheck, ShoppingBag, Sparkles, Store,
  Users, Wallet, X, Zap
} from "lucide-react";

function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <div className="nav-wrap container">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark"><ShoppingBag size={18} strokeWidth={2.5} /></span>
          <span>sell<span className="brand-light">sharp</span><i>.</i></span>
        </Link>
        <nav className={`nav-links ${open ? "nav-open" : ""}`}>
          <NavLink to="/features" onClick={close}>Features</NavLink>
          <NavLink to="/pricing" onClick={close}>Pricing</NavLink>
          <NavLink to="/faq" onClick={close}>FAQs</NavLink>
          <NavLink to="/contact" onClick={close}>Contact</NavLink>
          <div className="mobile-nav-actions">
            <Link className="btn btn-quiet" to="/login" onClick={close}>Log in</Link>
            <Link className="btn btn-primary" to="/register" onClick={close}>Create your store <ArrowRight size={16}/></Link>
          </div>
        </nav>
        <div className="nav-actions">
          <Link className="login-link" to="/login">Log in</Link>
          <Link className="btn btn-primary nav-cta" to="/register">Get started <ArrowUpRight size={16}/></Link>
        </div>
        <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          {open ? <X/> : <Menu/>}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand-col">
          <Link to="/" className="brand brand-footer"><span className="brand-mark"><ShoppingBag size={18}/></span><span>sell<span className="brand-light">sharp</span><i>.</i></span></Link>
          <p>Less order stress. More time to grow your business.</p>
          <span className="footer-location">Made for ambitious businesses in Nigeria.</span>
        </div>
        <div className="footer-col"><b>Product</b><Link to="/features">Features</Link><Link to="/pricing">Pricing</Link><Link to="/faq">FAQs</Link></div>
        <div className="footer-col"><b>Company</b><Link to="/about">About</Link><Link to="/contact">Contact</Link></div>
        <div className="footer-col"><b>Legal</b><Link to="/terms">Terms of service</Link><Link to="/privacy">Privacy policy</Link></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} SellSharp. All rights reserved.</span><span>Built for the way you sell.</span></div>
    </footer>
  );
}

function Layout({ children }: { children: ReactNode }) {
  return <><Header/><main>{children}</main><Footer/></>;
}

function SectionHeading({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body: string; center?: boolean }) {
  return <div className={`section-heading ${center ? "center" : ""}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{body}</p></div>;
}

function DashboardPreview() {
  return (
    <div className="dashboard-shell">
      <div className="dash-top"><div className="dash-brand"><span className="mini-mark"><ShoppingBag size={12}/></span> sellsharp</div><div className="dash-top-right"><span className="live-dot"/> Store is live <span className="avatar">A</span></div></div>
      <div className="dash-content">
        <aside className="dash-side"><span className="side-label">WORKSPACE</span><div className="side-item active"><BarChart3 size={14}/> Overview</div><div className="side-item"><ClipboardList size={14}/> Orders <b>8</b></div><div className="side-item"><Package size={14}/> Products</div><div className="side-item"><Users size={14}/> Customers</div><div className="side-item"><Wallet size={14}/> Debts</div><div className="side-item"><FileText size={14}/> Receipts</div><span className="side-label side-label-bottom">STORE</span><div className="side-item"><Store size={14}/> My storefront</div></aside>
        <div className="dash-main">
          <div className="dash-welcome"><div><small>MONDAY, 10 NOVEMBER</small><h3>Good morning, Amara <span>✦</span></h3><p>Here's what's happening with your store today.</p></div><span className="dash-period">Last 30 days <ChevronDown size={12}/></span></div>
          <div className="stat-grid">
            <div className="stat-card"><span>Total sales</span><strong>₦482,500</strong><small className="positive">↗ 12.8% <i>vs last month</i></small></div>
            <div className="stat-card"><span>Orders</span><strong>86</strong><small className="positive">↗ 8.2% <i>vs last month</i></small></div>
            <div className="stat-card"><span>Customers</span><strong>64</strong><small className="positive">↗ 4 new <i>this week</i></small></div>
            <div className="stat-card"><span>Outstanding</span><strong>₦36,000</strong><small className="neutral">12 customers owing</small></div>
          </div>
          <div className="dash-lower">
            <div className="chart-card"><div className="chart-title"><b>Sales overview</b><span>Revenue <ChevronDown size={11}/></span></div><div className="chart-total">₦182,400 <small>this month</small></div><div className="chart"><div className="chart-y"><span>₦80k</span><span>₦60k</span><span>₦40k</span><span>₦20k</span><span>₦0</span></div><div className="chart-plot"><div className="grid-line l1"/><div className="grid-line l2"/><div className="grid-line l3"/><div className="grid-line l4"/><svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-label="Illustrative sales chart"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity=".25"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs><path d="M0 94 C28 85 34 72 62 80 S105 58 130 66 S170 44 198 59 S237 34 264 45 S300 20 330 35 S380 8 420 16 L420 120 L0 120Z" fill="url(#fill)"/><path d="M0 94 C28 85 34 72 62 80 S105 58 130 66 S170 44 198 59 S237 34 264 45 S300 20 330 35 S380 8 420 16" fill="none" stroke="#8b72db" strokeWidth="2.5" strokeLinecap="round"/></svg><div className="chart-x"><span>Oct 13</span><span>Oct 20</span><span>Oct 27</span><span>Nov 3</span><span>Nov 10</span></div></div></div></div>
            <div className="orders-card"><div className="chart-title"><b>Recent orders</b><span>View all <ArrowUpRight size={11}/></span></div><div className="order-row"><span className="order-avatar lavender">CO</span><div><b>Chiamaka O.</b><small>Order #SS-1082</small></div><strong>₦24,500</strong></div><div className="order-row"><span className="order-avatar peach">TA</span><div><b>Tomi A.</b><small>Order #SS-1081</small></div><strong>₦18,000</strong></div><div className="order-row"><span className="order-avatar mint">IE</span><div><b>Ife E.</b><small>Order #SS-1080</small></div><strong>₦32,000</strong></div></div>
          </div>
          <div className="dash-footnote"><span className="live-dot"/> Preview data — your real store will show your business activity.</div>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const features = [
    { icon: ClipboardList, title: "Orders, organised", text: "Every order from your store lands in one clear dashboard. No more searching through old chats." },
    { icon: Users, title: "Customers you know", text: "Keep customer details, purchase history and notes together, ready when you need them." },
    { icon: FileText, title: "Receipts in seconds", text: "Create clean, branded receipts you can download, print or send straight to WhatsApp." },
    { icon: Wallet, title: "Keep debts in sight", text: "Record part-payments, see who owes what and keep outstanding balances from slipping through." },
    { icon: Store, title: "Your own online store", text: "Share one simple link where customers can browse your products and place orders." },
    { icon: BarChart3, title: "Know your numbers", text: "See sales, order activity and your best-selling products without doing the maths by hand." },
  ];
  return <Layout>
    <section className="hero-section"><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/><div className="container hero-grid">
      <div className="hero-copy"><div className="announcement"><span className="announcement-dot"/> A simpler way to run your online business <ArrowUpRight size={13}/></div><h1>Your business,<br/>in <em>better</em> order.</h1><p className="hero-sub">Orders in your chats. Customers in your head. Payments in different places. Bring it all together with one simple store and business dashboard.</p><div className="hero-actions"><Link to="/register" className="btn btn-primary btn-large">Create your store <ArrowRight size={17}/></Link><Link to="/features" className="text-link">See how it works <ArrowUpRight size={16}/></Link></div><div className="hero-proof"><div className="proof-avatars"><span>A</span><span>J</span><span>K</span><span>+</span></div><p>Made for the people building<br/><b>businesses one order at a time.</b></p></div></div>
      <div className="hero-visual"><div className="visual-orbit orbit-a"/><div className="visual-orbit orbit-b"/><div className="floating-tag tag-orders"><span className="tag-icon"><ShoppingBag size={15}/></span><div><b>New order received</b><small>₦24,500 · Just now</small></div><CheckCircle2 size={17} className="tag-check"/></div><DashboardPreview/><div className="floating-tag tag-receipt"><span className="receipt-icon"><FileText size={16}/></span><div><b>Receipt ready</b><small>Sent to customer</small></div><Check size={16} className="tag-check"/></div></div>
    </div><div className="container hero-bottom"><span>ONE HOME FOR YOUR</span><div><span><MessageCircle size={15}/> WhatsApp orders</span><span><Store size={15}/> Online storefront</span><span><CreditCard size={15}/> Payments</span><span><Users size={15}/> Customers</span></div></div></section>
    <section className="section section-white"><div className="container"><SectionHeading eyebrow="THE EVERYDAY PROBLEM" title="You started a business. Not a full-time admin job." body="Selling through WhatsApp works — until orders pile up, customers follow up and you can't remember who has paid." center/><div className="problem-grid"><div className="problem-card"><span className="problem-number">01</span><MessageCircle/><h3>Orders get buried</h3><p>A customer's order disappears between chats, voice notes and status replies.</p></div><div className="problem-card"><span className="problem-number">02</span><FileText/><h3>Details get forgotten</h3><p>Names, quantities, addresses and payment records end up scattered everywhere.</p></div><div className="problem-card"><span className="problem-number">03</span><Wallet/><h3>Money gets confusing</h3><p>Part-payments and unpaid balances are hard to follow when they're only in a notebook.</p></div></div></div></section>
    <section className="section section-soft"><div className="container"><div className="feature-intro"><SectionHeading eyebrow="MEET YOUR NEW WORKSPACE" title="The small-business tools that make a big difference." body="SellSharp gives your business a proper home — from the first customer click to the final receipt."/></div><div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><div className="feature-card" key={title}><span className="feature-icon"><Icon size={20}/></span><span className="feature-index">0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div><div className="center-action"><Link to="/features" className="btn btn-outline">Explore all features <ArrowRight size={16}/></Link></div></div></section>
    <section className="section section-white"><div className="container split-section"><div className="split-copy"><span className="eyebrow">YOUR STORE. YOUR LINK.</span><h2>Give customers one place to find everything you sell.</h2><p>Set up your storefront once. Add your products, share your link on WhatsApp, Instagram or anywhere your customers find you.</p><ul className="check-list"><li><CheckCircle2/> A clean page for your products</li><li><CheckCircle2/> Simple checkout for your customers</li><li><CheckCircle2/> New orders appear in your dashboard</li><li><CheckCircle2/> Your business name and identity front and centre</li></ul><Link to="/features" className="text-link">Take a closer look <ArrowRight size={16}/></Link></div><div className="store-preview"><div className="store-browser"><span/><span/><span/><small>sellsharp.ng/ama-hairs</small></div><div className="store-cover"><div className="store-logo">A.</div><span>AMA HAIR STUDIO</span><h3>Find your<br/>next favourite.</h3><p>Quality hair. Confidence in every look.</p></div><div className="store-products"><div><div className="product-img product-one"> </div><b>Silky Straight Wig</b><span>₦45,000</span></div><div><div className="product-img product-two"> </div><b>Body Wave Bundle</b><span>₦32,000</span></div><div><div className="product-img product-three"> </div><b>Luxury Closure</b><span>₦18,500</span></div></div><div className="store-bottom"><span><ShieldCheck size={14}/> Secure checkout</span><span><MessageCircle size={14}/> Chat with seller</span></div></div></div></section>
    <section className="section section-dark"><div className="container pricing-band"><div><span className="eyebrow eyebrow-light">SIMPLE, STRAIGHTFORWARD PRICING</span><h2>One plan. Everything you need to get organised.</h2><p>No complicated tiers. No surprise add-ons. Just the tools to run your store with more confidence.</p></div><div className="price-panel"><span className="price-label">SELLSHARP MONTHLY</span><div className="price-amount">₦3,000 <small>/ month</small></div><p>All the essentials for your growing business.</p><Link to="/pricing" className="btn btn-white">See what's included <ArrowRight size={16}/></Link><small className="price-note">Cancel anytime. Your business data stays yours.</small></div></div></section>
    <section className="section section-white"><div className="container final-cta"><span className="eyebrow">READY WHEN YOU ARE</span><h2>Make room for more business.</h2><p>Spend less time keeping track of everything — and more time doing what you do best.</p><Link to="/register" className="btn btn-primary btn-large">Get started with SellSharp <ArrowRight size={17}/></Link><small>Simple setup. Your own store link. One place to manage it all.</small></div></section>
  </Layout>;
}

const featureItems = [
  ["Your own storefront", "Give customers a link to browse your products, see prices and place orders. Your store carries your business name and identity.", Store],
  ["Order management", "Keep every order in one place. Review customer details, update order progress and find an order without digging through chats.", ClipboardList],
  ["Customer records", "Build a useful customer list with contact details, order history and notes, so repeat customers are easier to serve.", Users],
  ["Receipts & records", "Create a receipt for an order, keep a record and share it with a customer. Make every transaction feel more professional.", FileText],
  ["Debt tracking", "Record outstanding balances and partial payments. See what is still owed and keep payment history attached to the right customer.", Wallet],
  ["Sales overview", "Understand how your store is doing with a clear view of orders, sales and product activity.", BarChart3],
  ["Product catalogue", "Add product photos, descriptions, prices and availability so customers know what you have before they order.", Package],
  ["WhatsApp sharing", "Share your store link and send order or receipt details to customers through WhatsApp.", MessageCircle],
];
function Features() {
  return <Layout><PageHero eyebrow="FEATURES" title={<>A calmer way to<br/><em>run your business.</em></>} body="The practical tools you need to keep orders, customers and money organised — without adding another complicated system to your day."/><section className="section section-white"><div className="container feature-page-grid">{featureItems.map(([title,text,Icon],i)=>{const I=Icon as typeof Store;return <article className="feature-page-card" key={String(title)}><div className="feature-page-top"><span className="feature-icon"><I size={21}/></span><span>0{i+1}</span></div><h3>{String(title)}</h3><p>{String(text)}</p></article>})}</div></section><section className="section section-soft"><div className="container final-cta"><span className="eyebrow">ONE PLACE TO START</span><h2>Get your business out of the chat history.</h2><p>Create your store and give every order a proper place.</p><Link to="/register" className="btn btn-primary btn-large">Create your store <ArrowRight size={17}/></Link></div></section></Layout>;
}

function PageHero({ eyebrow, title, body }: { eyebrow:string; title:ReactNode; body:string }) {
  return <section className="page-hero"><div className="container"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></div></section>;
}

function Pricing() {
  const included = ["Your own online storefront and shareable link","Product catalogue with photos and prices","Order management and status updates","Customer records and order history","Branded receipts you can share","Debt and partial-payment tracking","Sales overview and basic reports","WhatsApp sharing tools"];
  return <Layout><PageHero eyebrow="PRICING" title={<>Straightforward pricing.<br/><em>No guesswork.</em></>} body="One simple plan with the essentials to organise your business and serve customers better."/><section className="section section-white"><div className="container pricing-layout"><div className="pricing-explain"><span className="eyebrow">MADE FOR GROWING BUSINESSES</span><h2>Everything you need.<br/>One monthly price.</h2><p>Start with the tools that help you take orders, keep customer records, send receipts and stay on top of payments.</p><div className="pricing-assurance"><ShieldCheck/><div><b>Your business stays yours</b><span>Your store and business records belong to you.</span></div></div><div className="pricing-assurance"><Zap/><div><b>Simple to get started</b><span>Set up your store and share your link.</span></div></div></div><div className="pricing-card"><div className="plan-top"><span>SELLSHARP PLAN</span><span className="plan-pill">Everything included</span></div><div className="plan-price">₦3,000 <small>/ month</small></div><p>For vendors ready to run their business with more clarity.</p><Link to="/register" className="btn btn-primary btn-full">Get started <ArrowRight size={16}/></Link><div className="plan-divider"/><b className="included-title">What's included</b><ul className="included-list">{included.map(x=><li key={x}><Check size={15}/>{x}</li>)}</ul><small className="plan-footnote">Subscription payments will be processed securely through Paystack.</small></div></div></section><section className="section section-soft"><div className="container final-cta"><h2>Questions before you start?</h2><p>We have answers to the things vendors ask most.</p><Link to="/faq" className="btn btn-outline">Visit the FAQs <ArrowRight size={16}/></Link></div></section></Layout>;
}

const faqs = [
  ["What is SellSharp?", "SellSharp is a business management platform for vendors who sell through WhatsApp, Instagram and other social channels. It gives you a storefront and a dashboard to manage orders, products, customers, receipts and outstanding balances."],
  ["Do I need a website already?", "No. SellSharp gives you a shareable storefront link. You can put it in your WhatsApp profile, Instagram bio or send it directly to customers."],
  ["How much does it cost?", "The planned subscription is ₦3,000 per month. The pricing page explains what is included."],
  ["Can customers order without creating an account?", "Yes. The intended checkout experience lets customers submit an order with their contact and delivery details without creating a SellSharp account."],
  ["How do customers pay?", "The initial product direction supports Paystack online payments. Payment confirmation will be verified securely by the platform before an order is marked as paid."],
  ["Can I track customers who owe me?", "Yes. The debt tracker is designed to show outstanding balances, partial payments and payment history for each customer."],
  ["Can I use SellSharp on my phone?", "Yes. The vendor dashboard and customer storefront are being designed to work on both mobile and desktop screens."],
  ["Can another vendor use my store link?", "Each store username is intended to be unique. Once a username is registered, another vendor cannot claim the same one."],
];
function FAQ() {
  const [active,setActive] = useState<number | null>(0);
  return <Layout><PageHero eyebrow="HELP CENTRE" title={<>Good questions.<br/><em>Clear answers.</em></>} body="A few things you may want to know before setting up your store."/><section className="section section-white"><div className="container faq-layout"><div className="faq-aside"><span className="faq-aside-icon"><CircleHelp size={22}/></span><h2>Still curious?</h2><p>If you need help understanding how SellSharp works, reach out and we'll point you in the right direction.</p><Link to="/contact" className="text-link">Contact us <ArrowRight size={15}/></Link></div><div className="faq-list">{faqs.map(([q,a],i)=><div className={`faq-item ${active===i?"faq-active":""}`} key={q}><button onClick={()=>setActive(active===i?null:i)}><span>{q}</span><ChevronDown size={18}/></button>{active===i&&<p>{a}</p>}</div>)}</div></div></section></Layout>;
}

function Contact() {
  const [sent,setSent] = useState(false);
  return <Layout><PageHero eyebrow="CONTACT" title={<>Let's talk about<br/><em>your business.</em></>} body="Have a question, need a hand or want to tell us what would make SellSharp more useful? We'd like to hear from you."/><section className="section section-white"><div className="container contact-layout"><div className="contact-info"><span className="eyebrow">GET IN TOUCH</span><h2>We're listening.</h2><p>Send us a message and tell us what you need help with. This contact form is currently a frontend preview.</p><div className="contact-method"><span><MessageCircle/></span><div><b>WhatsApp support</b><small>Support contact will be published at launch.</small></div></div><div className="contact-method"><span><FileText/></span><div><b>General enquiries</b><small>Use the message form and we'll get back to you.</small></div></div></div><form className="contact-form" onSubmit={e=>{e.preventDefault();setSent(true)}}><h3>Send a message</h3><label>Your name<input required placeholder="e.g. Amara Okafor"/></label><label>Email address<input required type="email" placeholder="you@example.com"/></label><label>What can we help with?<select defaultValue=""><option value="" disabled>Select a topic</option><option>Getting started</option><option>Pricing and payments</option><option>Store setup</option><option>Something else</option></select></label><label>Message<textarea required rows={4} placeholder="Tell us a little about what you need..."/></label><button className="btn btn-primary btn-full" type="submit">{sent?"Message noted in preview":"Send message"} <ArrowRight size={16}/></button>{sent&&<p className="form-success"><CheckCircle2 size={15}/> This is a frontend demo. Message delivery will be connected later.</p>}</form></div></section></Layout>;
}

function LegalPage({ type }: { type:"terms"|"privacy" }) {
  const privacy = type==="privacy";
  return <Layout><PageHero eyebrow={privacy?"PRIVACY":"LEGAL"} title={privacy?<>Your information<br/><em>matters.</em></>:<>Clear terms.<br/><em>Fair expectations.</em></>} body={privacy?"A plain-language preview of the privacy principles we intend to follow.":"A preview of the terms that will govern use of the SellSharp platform."}/><section className="section section-white"><div className="container legal-content"><div className="legal-notice"><ShieldCheck size={18}/><span>Draft preview — these pages must be reviewed and finalised before public launch.</span></div>{(privacy?[["Information you provide","SellSharp may collect account details, business information, product listings, customer order details and support messages needed to provide the service."],["How information is used","Information is used to operate the platform, display vendor storefronts, process orders, provide support, maintain security and improve the service."],["Payments","Online payments are intended to be processed by Paystack. Sensitive card details should be handled by the payment provider, not stored by SellSharp."],["Sharing and access","A vendor should only have access to their own private business records. Customer-facing information should be limited to what is needed to place and track an order."],["Security and retention","We intend to use access controls and appropriate security measures to protect information. Final retention and deletion policies will be published before launch."],["Your choices","You should be able to request access to, correction of or deletion of personal information, subject to applicable legal requirements."]]:[["Using SellSharp","SellSharp is intended to help vendors manage online storefronts, orders, customer records, receipts and business activity."],["Vendor responsibilities","Vendors are responsible for the accuracy of their listings, prices, stock information, fulfilment, customer communication and compliance with applicable laws."],["Subscriptions","The planned subscription is ₦3,000 per month. Billing, renewal, cancellation and access rules will be confirmed in the final subscription terms."],["Orders and payments","An order submission does not by itself prove payment. Payment status should only be updated after reliable payment confirmation."],["Acceptable use","Users must not misuse the platform, attempt to access another vendor's private information or upload unlawful or misleading content."],["Changes and availability","Features may change as the service develops. Any material changes to these terms will be communicated through the platform."]]).map(([h,p])=><article key={h}><h3>{h}</h3><p>{p}</p></article>)}</div></section></Layout>;
}

function AuthPlaceholder({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  return <Layout><section className="page-hero"><div className="container"><span className="eyebrow">PHASE 2</span><h1>{isRegister ? <>Your store starts<br/><em>here soon.</em></> : <>Welcome<br/><em>back soon.</em></>}</h1><p>{isRegister ? "Vendor registration and store setup are part of the next development phase. For now, explore the product preview." : "Vendor sign-in will be connected in the next development phase."}</p><Link to="/" className="btn btn-primary">Back to homepage <ArrowRight size={16}/></Link></div></section></Layout>;
}

function NotFound() {
  return <Layout><section className="page-hero"><div className="container"><span className="eyebrow">404 — PAGE NOT FOUND</span><h1>That page took<br/><em>a wrong turn.</em></h1><p>The page you're looking for doesn't exist or may have moved.</p><Link to="/" className="btn btn-primary">Back to homepage <ArrowRight size={16}/></Link></div></section></Layout>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/features" element={<Features/>}/>
    <Route path="/pricing" element={<Pricing/>}/>
    <Route path="/faq" element={<FAQ/>}/>
    <Route path="/contact" element={<Contact/>}/>
    <Route path="/terms" element={<LegalPage type="terms"/>}/>
    <Route path="/privacy" element={<LegalPage type="privacy"/>}/>
    <Route path="/login" element={<AuthPlaceholder mode="login"/>}/>
    <Route path="/register" element={<AuthPlaceholder mode="register"/>}/>
    <Route path="/about" element={<Layout><PageHero eyebrow="ABOUT" title={<>Built around the way<br/><em>you already sell.</em></>} body="SellSharp is being built to make the everyday work behind small online businesses feel simpler and more organised."/></Layout>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes>;
}