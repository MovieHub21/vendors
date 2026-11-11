import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, CircleHelp } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { FAQS } from "../data/faqs";
import { PAGE_META } from "../data/pageMeta";
import { breadcrumbJsonLd, faqJsonLd } from "../lib/seo";
import { crumbs } from "../lib/crumbs";

export default function Faq() {
  const [active, setActive] = useState<number | null>(0);
  return (
    <>
      <Seo seo={{ ...PAGE_META.faq, jsonLd: [faqJsonLd(FAQS), breadcrumbJsonLd(crumbs(PAGE_META.faq))] }} />
      <PageHero
        eyebrow="HELP CENTRE"
        title={
          <>
            Good questions.
            <br />
            <em>Clear answers.</em>
          </>
        }
        body="A few things you may want to know before setting up your store."
      />
      <section className="section section-white">
        <div className="container faq-layout">
          <div className="faq-aside">
            <span className="faq-aside-icon">
              <CircleHelp size={22} />
            </span>
            <h2>Still curious?</h2>
            <p>
              If you need help understanding how SellSharp works, reach out and we'll point you in the right direction.
            </p>
            <Link to="/contact" className="text-link">
              Contact us <ArrowRight size={15} />
            </Link>
          </div>
          <div className="faq-list">
            {FAQS.map(([q, a], i) => (
              <div className={`faq-item ${active === i ? "faq-active" : ""}`} key={q}>
                <button onClick={() => setActive(active === i ? null : i)}>
                  <span>{q}</span>
                  <ChevronDown size={18} />
                </button>
                {active === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
