import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { FEATURE_PAGE_ITEMS } from "../data/features";
import { PAGE_META } from "../data/pageMeta";
import { crumbs } from "../lib/crumbs";
import { breadcrumbJsonLd } from "../lib/seo";

export default function Features() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.features, jsonLd: [breadcrumbJsonLd(crumbs(PAGE_META.features))] }} />
      <PageHero
        eyebrow="FEATURES"
        title={
          <>
            A calmer way to
            <br />
            <em>run your business.</em>
          </>
        }
        body="The practical tools you need to keep orders, customers and money organised — without adding another complicated system to your day."
      />
      <section className="section section-white">
        <div className="container feature-page-grid">
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
      </section>
      <section className="section section-soft">
        <div className="container final-cta">
          <span className="eyebrow">ONE PLACE TO START</span>
          <h2>Get your business out of the chat history.</h2>
          <p>Create your store and give every order a proper place.</p>
          <Link to="/signup" className="btn btn-primary btn-large">
            Create your store <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
