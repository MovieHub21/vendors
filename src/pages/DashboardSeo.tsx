import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, CircleAlert, ExternalLink, Globe, Info } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { SerpPreview, SocialPreview } from "../components/SeoPreviews";
import { ShareButton } from "../components/ShareButton";
import { PAGE_META } from "../data/pageMeta";
import { storePath } from "../lib/routes";
import { generateStoreSeo, isPublicImageUrl, truncate } from "../lib/seo";
import { slugify } from "../lib/reservedSlugs";
import type { VendorStore } from "../types/store";
import { updateStoreSeo, type Me, type OwnStore, type SeoStatus } from "../services/api";

const PROBLEM_TEXT: Record<string, string> = {
  not_published: "Your store isn't live yet — it goes live once your subscription is active.",
  suspended: "Your store has been suspended.",
  indexing_disabled: "You've switched off Google visibility below — turn it back on to get found.",
  description_too_short: "Write a store description of at least 30 characters so Google knows what you sell.",
  missing_category: "Pick a business category for your store.",
  missing_location: "Add your state or city so customers nearby can find you.",
  no_eligible_products: "Add at least one published product with a photo and a description of 20+ characters.",
};

const asPublicStore = (s: OwnStore): VendorStore => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  tagline: s.tagline ?? undefined,
  description: s.description,
  category: s.category,
  categorySlug: slugify(s.category),
  city: s.city ?? undefined,
  state: s.state ?? undefined,
  logoUrl: s.logo_url ?? undefined,
  coverUrl: s.cover_url ?? undefined,
  ogImageUrl: s.og_image_url ?? undefined,
  isIndexable: false,
  productCount: 0,
  createdAt: "",
  updatedAt: "",
  lastModified: "",
});

const hasMarkup = (v: string) => /[<>]/.test(v);

function titleHint(v: string): string | null {
  if (hasMarkup(v)) return "Plain text only — please remove < and >.";
  if (v.length > 60) return `Too long (${v.length}/60) — Google may cut it off. Try to shorten it.`;
  return v && v.length < 30 ? `A bit short (${v.length} characters). Aim for 30–60 for best results.` : null;
}

function descriptionHint(v: string): string | null {
  if (hasMarkup(v)) return "Plain text only — please remove < and >.";
  if (v.length > 160) return `Too long (${v.length}/160) — trim it down so nothing gets cut off.`;
  return v && v.length < 70 ? `A bit short (${v.length} characters). Aim for 70–160 for best results.` : null;
}

function Row({ ok, label, detail }: { ok: boolean | "info"; label: string; detail: string }) {
  const Icon = ok === "info" ? Info : ok ? Check : CircleAlert;
  return (
    <li className={`seo-row ${ok === "info" ? "info" : ok ? "ok" : "todo"}`}>
      <Icon size={16} aria-hidden="true" />
      <span>
        <strong>{label}</strong> {detail}
      </span>
    </li>
  );
}

function SeoForm({ initial, initialStatus }: { initial: OwnStore; initialStatus: SeoStatus | null }) {
  const [store, setStore] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [title, setTitle] = useState(initial.seo_title ?? "");
  const [description, setDescription] = useState(initial.seo_description ?? "");
  const [keywords, setKeywords] = useState(initial.seo_keywords ?? "");
  const [image, setImage] = useState(initial.og_image_url ?? "");
  const [indexable, setIndexable] = useState(initial.indexable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewTab, setPreviewTab] = useState<"google" | "social">("google");

  const publicStore = useMemo(() => asPublicStore(store), [store]);
  const generated = generateStoreSeo(publicStore);
  const shownTitle = truncate(title.trim() || generated.title, 60);
  const shownDescription = truncate(description.trim() || generated.description, 160);
  const imageError =
    image && (hasMarkup(image) || !isPublicImageUrl(image) ? "Use a public https:// image address." : null);
  const socialImage =
    [image, store.og_image_url, store.cover_url, store.logo_url].find((u) => isPublicImageUrl(u)) ?? null;
  const blocked = Boolean(
    titleHint(title)?.startsWith("Too") ||
      titleHint(title)?.startsWith("Plain") ||
      descriptionHint(description)?.startsWith("Too") ||
      descriptionHint(description)?.startsWith("Plain") ||
      imageError,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (blocked) return setError("Please fix the highlighted fields.");
    setBusy(true);
    const result = await updateStoreSeo({
      seo_title: title,
      seo_description: description,
      seo_keywords: keywords,
      og_image_url: image,
      indexable,
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setStore(result.data.store);
    setStatus(result.data.seo_status);
    setSaved(true);
  }

  const problems = status?.problems ?? [];

  return (
    <div className="seo-desktop-grid">
      {/* LEFT COLUMN: Main Form Editor */}
      <div className="seo-form-col">
        <form onSubmit={onSubmit} noValidate className="dash-card seo-settings-card">
          <div className="seo-card-header">
            <div>
              <h2>How your store appears online</h2>
              <p className="muted">Control what people see when they find your store on Google, WhatsApp, or Instagram.</p>
            </div>
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="seo-title-input">Page title (shown on Google)</label>
              <span className={`char-meter ${title.length > 60 ? "meter-over" : title.length >= 30 ? "meter-good" : ""}`}>
                {title.length}/60
              </span>
            </div>
            <input
              id="seo-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={generated.title}
              maxLength={70}
            />
            <small className="field-hint">
              {titleHint(title) ?? "The headline people see when your store appears in Google search results. Leave empty to use a smart auto-generated title."}
            </small>
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="seo-desc-input">Search result description</label>
              <span className={`char-meter ${description.length > 160 ? "meter-over" : description.length >= 70 ? "meter-good" : ""}`}>
                {description.length}/160
              </span>
            </div>
            <textarea
              id="seo-desc-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={generated.description}
              maxLength={200}
            />
            <small className="field-hint">
              {descriptionHint(description) ?? "A short summary that tells people what you sell before they click your link. Leave empty to generate automatically from your store description."}
            </small>
          </div>

          <Field
            label="Words customers search for (optional)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            maxLength={200}
            placeholder="e.g. human hair wigs, lace front, bone straight, Lagos"
            hint="Type the words your customers use when looking for a store like yours. This helps you stay focused — Google uses your actual page content to rank you."
          />

          <div className="field">
            <label htmlFor="seo-img-input">Link preview photo (optional)</label>
            <input
              id="seo-img-input"
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…/social-banner.jpg"
            />
            {imageError && <small className="field-error">{imageError}</small>}
            <small className="field-hint">
              When someone shares your store link on WhatsApp or Instagram, this photo is what appears. Use a wide/landscape photo (~1200×630 px) for the best look.
            </small>
          </div>

          <div className="seo-check-box">
            <label className="check">
              <input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} />
              <span>
                <strong>Show my store on Google &amp; search engines</strong>
                <small className="muted" style={{ display: "block" }}>
                  When turned on, your store can appear in Google search results and be discovered by new customers.
                </small>
              </span>
            </label>
          </div>

          {error && <Alert kind="error">{error}</Alert>}
          {saved && (
            <Alert kind="success">
              Saved successfully! Updates reach search crawlers and link previews shortly.
            </Alert>
          )}

          <div className="quick-actions" style={{ marginTop: "18px" }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving settings…" : "Save SEO settings"}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: Sticky Previews & SEO Checklist */}
      <div className="seo-sidebar-col">
        {/* Store URL & Share Card */}
        <div className="dash-card seo-url-card">
          <div className="seo-url-top">
            <Globe size={18} className="seo-globe-icon" aria-hidden="true" />
            <h3>Your Public Store Link</h3>
          </div>
          <p className="seo-url-text">
            {store.is_published ? (
              <a href={storePath(store.slug)} target="_blank" rel="noopener noreferrer">
                sellsharp.ng{storePath(store.slug)} <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : (
              <span>
                sellsharp.ng{storePath(store.slug)} <small>(active once subscription is live)</small>
              </span>
            )}
          </p>
          <div className="seo-share-wrap">
            <ShareButton path={storePath(store.slug)} kind="store" title={store.name} text={`Shop from ${store.name}`} />
          </div>
        </div>

        {/* Live Previews Card */}
        <div className="dash-card seo-previews-card">
          <div className="seo-tabs-header">
            <h3>Live previews</h3>
            <div className="seg seg-small" role="tablist">
              <button
                type="button"
                className={previewTab === "google" ? "on" : ""}
                onClick={() => setPreviewTab("google")}
              >
                How it looks on Google
              </button>
              <button
                type="button"
                className={previewTab === "social" ? "on" : ""}
                onClick={() => setPreviewTab("social")}
              >
                When shared on WhatsApp
              </button>
            </div>
          </div>

          <div className="seo-preview-body">
            {previewTab === "google" ? (
              <SerpPreview title={shownTitle} path={storePath(store.slug)} description={shownDescription} />
            ) : (
              <SocialPreview
                title={store.name}
                description={truncate(store.description || shownDescription, 120)}
                image={socialImage}
              />
            )}
          </div>
          <small className="muted" style={{ display: "block", marginTop: "10px", fontSize: "11px" }}>
            Interactive illustration. Search engines and messaging apps format previews based on screen width.
          </small>
        </div>

        {/* SEO Status & Checklist Card */}
        <div className="dash-card seo-status-card">
          <h3>Your store's online visibility</h3>
          <ul className="seo-rows">
            <Row
              ok={store.seo_title !== null}
              label="Page title:"
              detail={store.seo_title ? "Custom" : "Auto-generated"}
            />
            <Row
              ok={store.seo_description !== null}
              label="Search description:"
              detail={store.seo_description ? "Custom" : "Auto-generated"}
            />
            <Row
              ok={Boolean(status?.has_social_image)}
              label="Link preview photo:"
              detail={status?.has_social_image ? "Configured" : "Not set (uses default)"}
            />
            <Row
              ok={Boolean(store.category)}
              label="Category:"
              detail={store.category || "Missing"}
            />
            <Row
              ok={Boolean(store.state || store.city)}
              label="Location:"
              detail={[store.city, store.state].filter(Boolean).join(", ") || "Missing"}
            />
            <Row
              ok={Boolean(status?.published)}
              label="Store live:"
              detail={status?.published ? "Active" : "Not active yet"}
            />
            <Row
              ok={Boolean(status?.eligible)}
              label="Can be found on Google:"
              detail={status?.eligible ? "Yes — included in sitemap" : "Not yet"}
            />
          </ul>

          {problems.length > 0 && (
            <div className="seo-todo">
              <strong>Steps to get found on Google:</strong>
              <ul>
                {problems.map((p) => (
                  <li key={p}>{PROBLEM_TEXT[p] ?? p}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="seo-counts">
            You have {status?.published_products ?? 0} published product{(status?.published_products ?? 0) === 1 ? "" : "s"},{" "}
            {status?.eligible_products ?? 0} of which {(status?.eligible_products ?? 0) === 1 ? "is" : "are"} ready to show on Google.
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardSeoView({ me }: { me: Me }) {
  if (!me.store) {
    return (
      <div className="dash-card">
        <Alert kind="info">
          Please complete your store setup in onboarding first, then return here to configure SEO.
        </Alert>
        <Link to="/onboarding" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
          Go to Onboarding
        </Link>
      </div>
    );
  }

  return <SeoForm initial={me.store} initialStatus={me.seo_status} />;
}

export default function DashboardSeo() {
  return (
    <DashboardShell seo={PAGE_META.dashboardSeo} title="Store SEO">
      {(me) => <DashboardSeoView me={me} />}
    </DashboardShell>
  );
}
