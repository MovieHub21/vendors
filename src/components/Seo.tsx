import { Helmet } from "react-helmet-async";
import { fullTitle, jsonLdString, type PageSeo } from "../lib/seo";
import { SITE, absoluteUrl } from "../lib/site";

/** Renders every head tag a page needs: title, description, robots, canonical, Open Graph, Twitter and JSON-LD. */
export function Seo({ seo }: { seo: PageSeo }) {
  const title = fullTitle(seo);
  const url = absoluteUrl(seo.path);
  const image = absoluteUrl(seo.image ?? SITE.ogImage);
  const imageAlt = seo.imageAlt ?? SITE.ogImageAlt;
  const robots = seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:type" content={seo.type ?? "website"} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={image} />

      {(seo.jsonLd ?? []).map((data, i) => (
        <script key={i} type="application/ld+json">
          {jsonLdString(data)}
        </script>
      ))}
    </Helmet>
  );
}
