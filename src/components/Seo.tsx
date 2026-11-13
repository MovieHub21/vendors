import { Helmet } from "react-helmet-async";

import { fullTitle, jsonLdString, robotsContent, type PageSeo } from "../lib/seo";
import { koboToDecimalString } from "../lib/money";
import { SITE, absoluteUrl } from "../lib/site";

/** Renders every head tag a page needs: title, description, robots, canonical, Open Graph, Twitter and JSON-LD. */
export function Seo({ seo }: { seo: PageSeo }) {
  const title = fullTitle(seo);
  const url = absoluteUrl(seo.path);
  const image = absoluteUrl(seo.image ?? SITE.ogImage);
  const imageAlt = seo.imageAlt ?? SITE.ogImageAlt;

  const ogTitle = seo.ogTitle ?? title;
  const ogDescription = seo.ogDescription ?? seo.description;
  // A square logo reads better as a small card; real banners and product photos get the large card.
  const card = seo.imageKind === "logo" ? "summary" : "summary_large_image";


  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={seo.description} />

      <meta name="robots" content={robotsContent(seo)} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:type" content={seo.type ?? "website"} />

      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      {seo.imageWidth && seo.imageHeight && <meta property="og:image:width" content={String(seo.imageWidth)} />}
      {seo.imageWidth && seo.imageHeight && <meta property="og:image:height" content={String(seo.imageHeight)} />}
      <meta property="og:image:alt" content={imageAlt} />

      {seo.price && <meta property="product:price:amount" content={koboToDecimalString(seo.price.amountKobo)} />}
      {seo.price && <meta property="product:price:currency" content="NGN" />}
      {seo.price && (
        <meta property="product:availability" content={seo.price.available ? "in stock" : "out of stock"} />
      )}

      <meta name="twitter:card" content={card} />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={ogDescription} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />


      {(seo.jsonLd ?? []).map((data, i) => (
        <script key={i} type="application/ld+json">
          {jsonLdString(data)}
        </script>
      ))}
    </Helmet>
  );
}
