import { Helmet } from "react-helmet-async";
<<<<<<< HEAD
import { fullTitle, jsonLdString, robotsContent, type PageSeo } from "../lib/seo";
import { koboToDecimalString } from "../lib/money";
=======
import { fullTitle, jsonLdString, type PageSeo } from "../lib/seo";
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
import { SITE, absoluteUrl } from "../lib/site";

/** Renders every head tag a page needs: title, description, robots, canonical, Open Graph, Twitter and JSON-LD. */
export function Seo({ seo }: { seo: PageSeo }) {
  const title = fullTitle(seo);
  const url = absoluteUrl(seo.path);
  const image = absoluteUrl(seo.image ?? SITE.ogImage);
  const imageAlt = seo.imageAlt ?? SITE.ogImageAlt;
<<<<<<< HEAD
  const ogTitle = seo.ogTitle ?? title;
  const ogDescription = seo.ogDescription ?? seo.description;
  // A square logo reads better as a small card; real banners and product photos get the large card.
  const card = seo.imageKind === "logo" ? "summary" : "summary_large_image";
=======
  const robots = seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={seo.description} />
<<<<<<< HEAD
      <meta name="robots" content={robotsContent(seo)} />
=======
      <meta name="robots" content={robots} />
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:type" content={seo.type ?? "website"} />
<<<<<<< HEAD
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
=======
      <meta property="og:title" content={title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={image} />
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

      {(seo.jsonLd ?? []).map((data, i) => (
        <script key={i} type="application/ld+json">
          {jsonLdString(data)}
        </script>
      ))}
    </Helmet>
  );
}
