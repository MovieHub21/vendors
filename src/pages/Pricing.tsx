import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, Zap } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { PRICING_INCLUDED } from "../data/features";
import { PAGE_META } from "../data/pageMeta";
import { breadcrumbJsonLd, softwareJsonLd } from "../lib/seo";
import { crumbs } from "../lib/crumbs";

export default function Pricing() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.pricing, jsonLd: [softwareJsonLd(), breadcrumbJsonLd(crumbs(PAGE_META.pricing))] }} />
      <PageHero
        eyebrow="PRICING"
        title={
          <>
            Straightforward pricing.
            <br />
            <em>No guesswork.</em>
          </>
        }
        body="One simple plan with the essentials to organise your business and serve customers better."
      />
      <section className="section section-white">
        <div className="container pricing-layout">
          <div className="pricing-explain">
            <span className="eyebrow">MADE FOR GROWING BUSINESSES</span>
            <h2>
              Everything you need.
              <br />
              One monthly price.
            </h2>
            <p>
              Start with the tools that help you take orders, keep customer records, send receipts and stay on top of
              payments.
            </p>
            <div className="pricing-assurance">
              <ShieldCheck />
              <div>
                <b>Your business stays yours</b>
                <span>Your store and business records belong to you.</span>
              </div>
            </div>
            <div className="pricing-assurance">
              <Zap />
              <div>
                <b>Simple to get started</b>
                <span>Set up your store and share your link.</span>
              </div>
            </div>
          </div>
          <div className="pricing-card">
            <div className="plan-top">
              <span>SELLSHARP PLAN</span>
              <span className="plan-pill">Everything included</span>
            </div>
            <div className="plan-price">
              ₦3,000 <small>/ month</small>
            </div>
            <p>For vendors ready to run their business with more clarity.</p>
            <Link to="/signup" className="btn btn-primary btn-full">
              Get started <ArrowRight size={16} />
            </Link>
            <div className="plan-divider" />
            <b className="included-title">What's included</b>
            <ul className="included-list">
              {PRICING_INCLUDED.map((x) => (
                <li key={x}>
                  <Check size={15} />
                  {x}
                </li>
              ))}
            </ul>
            <small className="plan-footnote">Subscription payments will be processed securely through Paystack.</small>
          </div>
        </div>
      </section>
      <section className="section section-soft">
        <div className="container final-cta">
          <h2>Questions before you start?</h2>
          <p>We have answers to the things vendors ask most.</p>
          <Link to="/faq" className="btn btn-outline">
            Visit the FAQs <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
