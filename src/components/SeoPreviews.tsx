import { SITE, absoluteUrl } from "../lib/site";

/** Illustrative only: Google decides the real title and snippet it shows. */
export function SerpPreview({ title, path, description }: { title: string; path: string; description: string }) {
  const url = absoluteUrl(path).replace(/^https?:\/\//, "");
  return (
    <div className="serp" aria-label="Google search result preview">
      <span className="serp-url">{url}</span>
      <span className="serp-title">{title}</span>
      <span className="serp-desc">{description}</span>
    </div>
  );
}

/** What a link preview can look like in WhatsApp, Facebook or X. */
export function SocialPreview({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: string | null;
}) {
  return (
    <div className="social-card" aria-label="Link preview">
      <div className="social-img">
        {image ? (
          <img src={image} alt="" width={600} height={315} loading="lazy" />
        ) : (
          <span>SellSharp default image</span>
        )}
      </div>
      <div className="social-text">
        <small>{new URL(SITE.url).hostname}</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
