import { ShieldCheck } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "../data/legal";
import { PAGE_META } from "../data/pageMeta";
import { crumbs } from "../lib/crumbs";
import { breadcrumbJsonLd } from "../lib/seo";

export default function Legal({ type }: { type: "terms" | "privacy" }) {
  const privacy = type === "privacy";
  const meta = privacy ? PAGE_META.privacy : PAGE_META.terms;
  const sections = privacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  return (
    <>
      <Seo seo={{ ...meta, jsonLd: [breadcrumbJsonLd(crumbs(meta))] }} />
      <PageHero
        eyebrow={privacy ? "PRIVACY" : "LEGAL"}
        title={
          privacy ? (
            <>
              Your information
              <br />
              <em>matters.</em>
            </>
          ) : (
            <>
              Clear terms.
              <br />
              <em>Fair expectations.</em>
            </>
          )
        }
        body={
          privacy
            ? "A plain-language preview of the privacy principles we intend to follow."
            : "A preview of the terms that will govern use of the SellSharp platform."
        }
      />
      <section className="section section-white">
        <div className="container legal-content">
          <div className="legal-notice">
            <ShieldCheck size={18} />
            <span>Draft preview — these pages must be reviewed and finalised before public launch.</span>
          </div>
          {sections.map(([heading, body]) => (
            <article key={heading}>
              <h3>{heading}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
