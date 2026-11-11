import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { crumbs } from "../lib/crumbs";
import { breadcrumbJsonLd } from "../lib/seo";

export default function About() {
  return (
    <>
      <Seo seo={{ ...PAGE_META.about, jsonLd: [breadcrumbJsonLd(crumbs(PAGE_META.about))] }} />
      <PageHero
        eyebrow="ABOUT"
        title={
          <>
            Built around the way
            <br />
            <em>you already sell.</em>
          </>
        }
        body="SellSharp is being built to make the everyday work behind small online businesses feel simpler and more organised."
      />
    </>
  );
}
