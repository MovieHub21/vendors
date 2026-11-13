import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { PAGE_META } from "../data/pageMeta";
import { storePath } from "../lib/routes";
import { isPublicImageUrl } from "../lib/seo";
import { updateStoreSeo, type Me } from "../services/api";
import { listProducts, type ProductRow } from "../services/vendorData";
import { supabase } from "../lib/supabase";
import type { Product, VendorStore } from "../types/store";
import { StoreHome } from "./public/StoreHome";

type Layout = "editorial" | "classic" | "minimal" | "showcase";
type Device = "desktop" | "mobile";
const SOCIAL_FIELDS = [
  ["instagram_url", "Instagram"], ["facebook_url", "Facebook"], ["tiktok_url", "TikTok"],
  ["youtube_url", "YouTube"], ["x_url", "X"], ["threads_url", "Threads"],
  ["snapchat_url", "Snapchat"], ["pinterest_url", "Pinterest"], ["linkedin_url", "LinkedIn"],
] as const;

const layouts: { id: Layout; name: string; detail: string }[] = [
  { id: "showcase", name: "Showcase", detail: "A full-width hero, category row, product collection and two image banners." },
  { id: "editorial", name: "Editorial", detail: "A bold landscape cover and overlapping store profile." },
  { id: "classic", name: "Classic", detail: "A balanced banner with a clean, straightforward profile." },
  { id: "minimal", name: "Minimal", detail: "A compact cover with a lighter, open store profile." },
];

function mapPreviewProduct(row: ProductRow, storeSlug: string): Product {
  return {
    id: row.id,
    storeSlug,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceKobo: row.price_kobo,
    category: row.category ?? undefined,
    images: row.product_images.map((image) => ({ url: image.url, alt: image.alt_text })),
    isAvailable: row.is_available,
    isIndexable: false,
    createdAt: "",
    updatedAt: "",
  };
}

function makePreviewStore(store: NonNullable<Me["store"]>, layout: Layout, values: Record<string, string>, products: Product[]): VendorStore {
  const slug = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: store.id, slug: store.slug, name: store.name, tagline: values.tagline || undefined,
    description: store.description, category: store.category, categorySlug: slug(store.category),
    city: store.city ?? undefined, citySlug: slug(store.city), state: store.state ?? undefined, stateSlug: slug(store.state),
    logoUrl: store.logo_url ?? undefined, coverUrl: values.cover_url || undefined,
    contactPhone: store.contact_phone ?? undefined, storefrontLayout: layout,
    heroEyebrow: values.hero_eyebrow || undefined, heroTitle: values.hero_title || undefined,
    heroDescription: values.hero_description || undefined, heroButtonText: values.hero_button_text || undefined,
    categoryHeading: values.category_heading || undefined, productsHeading: values.products_heading || undefined,
    promoOneTitle: values.promo_one_title || undefined, promoOneText: values.promo_one_text || undefined,
    promoOneImageUrl: values.promo_one_image_url || undefined, promoTwoTitle: values.promo_two_title || undefined,
    promoTwoText: values.promo_two_text || undefined, promoTwoImageUrl: values.promo_two_image_url || undefined,
    instagramUrl: values.instagram_url || undefined, facebookUrl: values.facebook_url || undefined,
    tiktokUrl: values.tiktok_url || undefined, youtubeUrl: values.youtube_url || undefined,
    xUrl: values.x_url || undefined, threadsUrl: values.threads_url || undefined,
    snapchatUrl: values.snapchat_url || undefined, pinterestUrl: values.pinterest_url || undefined,
    linkedinUrl: values.linkedin_url || undefined, otherSocialLabel: values.other_social_label || undefined,
    otherSocialUrl: values.other_social_url || undefined, isIndexable: false, productCount: products.length,
    isDemo: false, createdAt: "", updatedAt: "", lastModified: "",
  };
}

function StorefrontPreview({ store, products, device }: { store: VendorStore; products: Product[]; device: Device }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [frameRoot, setFrameRoot] = useState<HTMLElement | null>(null);
  const [desktopScale, setDesktopScale] = useState(0.5);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => setDesktopScale(Math.min(0.55, stage.clientWidth / 1080, (window.innerHeight * 0.77) / 1400));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [device]);
  function loadFrame() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") || "light");
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => doc.head.appendChild(node.cloneNode(true)));
    doc.addEventListener("click", (event) => {
      if ((event.target as HTMLElement | null)?.closest("a")) event.preventDefault();
    }, true);
    setFrameRoot(doc.getElementById("preview-root"));
  }
  const portal = frameRoot ? createPortal(<StoreHome store={store} products={products.slice(0, 12)} preview />, frameRoot) : null;
  const scale = device === "desktop" ? desktopScale : 1;
  const frameWidth = device === "desktop" ? 1080 : 390;
  const frameHeight = device === "desktop" ? 1400 : 690;
  return <div ref={stageRef} className={`storefront-preview-stage is-${device}`} style={{ height: `${frameHeight * scale}px` }}>
    <iframe ref={iframeRef} title={`${device} storefront preview`} onLoad={loadFrame} srcDoc="<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='margin:0'><div id='preview-root'></div></body></html>" style={{ width: `${frameWidth}px`, height: `${frameHeight}px`, transform: `scale(${scale})`, transformOrigin: "top left" }} />
    {portal}
  </div>;
}

function DesignForm({ me }: { me: Me }) {
  const store = me.store!;
  const [layout, setLayout] = useState<Layout>(store.storefront_layout ?? "showcase");
  const [values, setValues] = useState<Record<string, string>>({
    cover_url: store.cover_url ?? "",
    tagline: store.tagline ?? "",
    hero_eyebrow: store.hero_eyebrow ?? "",
    hero_title: store.hero_title ?? "",
    hero_description: store.hero_description ?? "",
    hero_button_text: store.hero_button_text ?? "",
    category_heading: store.category_heading ?? "",
    products_heading: store.products_heading ?? "",
    promo_one_title: store.promo_one_title ?? "",
    promo_one_text: store.promo_one_text ?? "",
    promo_one_image_url: store.promo_one_image_url ?? "",
    promo_two_title: store.promo_two_title ?? "",
    promo_two_text: store.promo_two_text ?? "",
    promo_two_image_url: store.promo_two_image_url ?? "",
    instagram_url: store.instagram_url ?? "",
    facebook_url: store.facebook_url ?? "",
    tiktok_url: store.tiktok_url ?? "",
    youtube_url: store.youtube_url ?? "",
    x_url: store.x_url ?? "",
    threads_url: store.threads_url ?? "",
    snapchat_url: store.snapchat_url ?? "",
    pinterest_url: store.pinterest_url ?? "",
    linkedin_url: store.linkedin_url ?? "",
    other_social_label: store.other_social_label ?? "",
    other_social_url: store.other_social_url ?? "",
  });
  const [device, setDevice] = useState<Device>("desktop");
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const refs = {
    cover_url: useRef<HTMLInputElement>(null),
    promo_one_image_url: useRef<HTMLInputElement>(null),
    promo_two_image_url: useRef<HTMLInputElement>(null),
  };
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    void listProducts().then((result) => {
      if (result.ok) setProducts(result.data.filter((item) => item.status === "published").map((item) => mapPreviewProduct(item, store.slug)));
    });
  }, [store.slug]);

  async function uploadImage(key: keyof typeof refs, file?: File) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file for this storefront image.");
    if (file.size > 5 * 1024 * 1024) return setError("Choose an image under 5 MB.");
    if (!supabase) return setError("Image uploads aren't available until storage is connected.");
    setUploading(key);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
      const objectName = `store-design/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(objectName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      set(key, supabase.storage.from("product-images").getPublicUrl(objectName).data.publicUrl);
    } catch {
      setError("We couldn't upload that image. Check that storage is configured, then try again.");
    } finally {
      setUploading(null);
      if (refs[key].current) refs[key].current.value = "";
    }
  }

  const imageKeys = ["cover_url", "promo_one_image_url", "promo_two_image_url"] as const;
  const invalidImages = [...imageKeys, ...SOCIAL_FIELDS.map(([key]) => key), "other_social_url"].some((key) => values[key].trim() && !isPublicImageUrl(values[key].trim()));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    if (invalidImages) return setError("Use public HTTPS image links for all storefront images.");
    setBusy(true);
    const result = await updateStoreSeo({
      storefront_layout: layout,
      cover_url: values.cover_url.trim(),
      tagline: values.tagline.trim(),
      hero_eyebrow: values.hero_eyebrow.trim(),
      hero_title: values.hero_title.trim(),
      hero_description: values.hero_description.trim(),
      hero_button_text: values.hero_button_text.trim(),
      category_heading: values.category_heading.trim(),
      products_heading: values.products_heading.trim(),
      promo_one_title: values.promo_one_title.trim(),
      promo_one_text: values.promo_one_text.trim(),
      promo_one_image_url: values.promo_one_image_url.trim(),
      promo_two_title: values.promo_two_title.trim(),
      promo_two_text: values.promo_two_text.trim(),
      promo_two_image_url: values.promo_two_image_url.trim(),
      facebook_url: values.facebook_url.trim(),
      instagram_url: values.instagram_url.trim(),
      tiktok_url: values.tiktok_url.trim(),
      youtube_url: values.youtube_url.trim(),
      x_url: values.x_url.trim(),
      threads_url: values.threads_url.trim(),
      snapchat_url: values.snapchat_url.trim(),
      pinterest_url: values.pinterest_url.trim(),
      linkedin_url: values.linkedin_url.trim(),
      other_social_label: values.other_social_label.trim(),
      other_social_url: values.other_social_url.trim(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSaved(true);
  }

  const previewStore = makePreviewStore(store, layout, values, products);

  return (
    <div className="store-design-workspace">
      <form className="dash-card store-design-form" onSubmit={submit}>
        <div className="seo-card-header"><div><h2>Design your storefront</h2><p className="muted">Choose a layout, add your own store images and customize the words customers see. Changes are previewed as you type.</p></div></div>
        <fieldset className="store-layout-options"><legend>Store layout</legend>
          {layouts.map((option) => <label key={option.id} className={`store-layout-option${layout === option.id ? " selected" : ""}`}>
            <input type="radio" name="layout" value={option.id} checked={layout === option.id} onChange={() => setLayout(option.id)} />
            <span><b>{option.name}</b><small>{option.detail}</small></span>
          </label>)}
        </fieldset>

        <section className="design-fields-group"><h3>Store introduction</h3>
          <Field label="Hero eyebrow (optional)" value={values.hero_eyebrow} maxLength={50} placeholder={store.category || "Your collection"} onChange={(e) => set("hero_eyebrow", e.target.value)} />
          <Field label="Hero headline" value={values.hero_title} maxLength={90} placeholder={values.tagline || "Find your next favourite."} onChange={(e) => set("hero_title", e.target.value)} />
          <div className="field"><label htmlFor="design-hero-copy">Hero description</label><textarea id="design-hero-copy" rows={3} value={values.hero_description} maxLength={200} placeholder={store.description || "Introduce your store to customers."} onChange={(e) => set("hero_description", e.target.value)} /><small className="field-hint">Up to 200 characters.</small></div>
          <Field label="Hero button label" value={values.hero_button_text} maxLength={32} placeholder="Shop the collection" onChange={(e) => set("hero_button_text", e.target.value)} />
          <Field label="Landscape hero image (optional)" type="url" value={values.cover_url} maxLength={500} placeholder="https://…/your-store-banner.jpg" onChange={(e) => set("cover_url", e.target.value)} hint="A wide landscape image works best. Leave it empty to use the built-in store banner." error={values.cover_url.trim() && !isPublicImageUrl(values.cover_url.trim()) ? "Enter a public HTTPS image address." : null} />
          <ImageUpload inputRef={refs.cover_url} busy={uploading === "cover_url"} onUpload={(file) => void uploadImage("cover_url", file)} />
        </section>

        <section className="design-fields-group"><h3>Shop sections</h3>
          <Field label="Categories heading" value={values.category_heading} maxLength={50} placeholder="Shop by category" onChange={(e) => set("category_heading", e.target.value)} />
          <Field label="Products heading" value={values.products_heading} maxLength={60} placeholder="Our collection" onChange={(e) => set("products_heading", e.target.value)} />
        </section>

        <section className="design-fields-group"><h3>First promotional banner</h3>
          <Field label="Banner heading" value={values.promo_one_title} maxLength={60} placeholder="A little something special" onChange={(e) => set("promo_one_title", e.target.value)} />
          <div className="field"><label htmlFor="design-promo-one-copy">Banner description</label><textarea id="design-promo-one-copy" rows={2} value={values.promo_one_text} maxLength={140} placeholder="Discover a new favourite from our collection." onChange={(e) => set("promo_one_text", e.target.value)} /></div>
          <Field label="Banner image (optional)" type="url" value={values.promo_one_image_url} maxLength={500} placeholder="https://…/first-banner.jpg" onChange={(e) => set("promo_one_image_url", e.target.value)} error={values.promo_one_image_url.trim() && !isPublicImageUrl(values.promo_one_image_url.trim()) ? "Enter a public HTTPS image address." : null} />
          <ImageUpload inputRef={refs.promo_one_image_url} busy={uploading === "promo_one_image_url"} onUpload={(file) => void uploadImage("promo_one_image_url", file)} />
        </section>

        <section className="design-fields-group"><h3>Second promotional banner</h3>
          <Field label="Banner heading" value={values.promo_two_title} maxLength={60} placeholder="Picked for your everyday" onChange={(e) => set("promo_two_title", e.target.value)} />
          <div className="field"><label htmlFor="design-promo-two-copy">Banner description</label><textarea id="design-promo-two-copy" rows={2} value={values.promo_two_text} maxLength={140} placeholder="See what is new at your store." onChange={(e) => set("promo_two_text", e.target.value)} /></div>
          <Field label="Banner image (optional)" type="url" value={values.promo_two_image_url} maxLength={500} placeholder="https://…/second-banner.jpg" onChange={(e) => set("promo_two_image_url", e.target.value)} error={values.promo_two_image_url.trim() && !isPublicImageUrl(values.promo_two_image_url.trim()) ? "Enter a public HTTPS image address." : null} />
          <ImageUpload inputRef={refs.promo_two_image_url} busy={uploading === "promo_two_image_url"} onUpload={(file) => void uploadImage("promo_two_image_url", file)} />
        </section>

        <section className="design-fields-group"><h3>Business WhatsApp</h3><p className="muted">Customer chat and new orders use the business WhatsApp number you entered during store setup: <strong>{store.contact_phone || "No number on file"}</strong>.</p></section>
        <section className="design-fields-group"><h3>Follow us</h3><p className="muted">Add the social pages you use. Only links you fill in appear above your store navigation.</p>
          <div className="social-link-fields">{SOCIAL_FIELDS.map(([key, label]) => <Field key={key} label={`${label} page`} type="url" value={values[key]} maxLength={500} placeholder={`https://${label.toLowerCase().replace(" ", "")}.com/your-page`} onChange={(e) => set(key, e.target.value)} error={values[key].trim() && !isPublicImageUrl(values[key].trim()) ? "Enter a public HTTPS link." : null} />)}</div>
          <div className="field-row"><Field label="Other social platform" value={values.other_social_label} maxLength={32} placeholder="e.g. Lemon8" onChange={(e) => set("other_social_label", e.target.value)} /><Field label="Other page link" type="url" value={values.other_social_url} maxLength={500} placeholder="https://…" onChange={(e) => set("other_social_url", e.target.value)} error={values.other_social_url.trim() && !isPublicImageUrl(values.other_social_url.trim()) ? "Enter a public HTTPS link." : null} /></div>
        </section>
        {error && <Alert kind="error">{error}</Alert>}
        {saved && <Alert kind="success">Your storefront design is saved and live.</Alert>}
        <button className="btn btn-primary" type="submit" disabled={busy || invalidImages || Boolean(uploading)}>{busy ? "Saving design…" : "Save and publish design"}</button>
      </form>

      <aside className="store-design-preview-column">
        <div className="dash-card store-design-preview-card">
          <div className="store-preview-heading"><div><span className="store-design-preview-label">Live preview</span><p className="muted">Preview your store as your customers will see it.</p></div><div className="store-preview-toggle" role="group" aria-label="Preview device"><button type="button" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>Desktop</button><button type="button" className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>Mobile</button></div></div>
          <StorefrontPreview store={previewStore} products={products} device={device} />
          <a className="btn btn-outline store-preview-open" href={storePath(store.slug)} target="_blank" rel="noopener noreferrer">Open live storefront <ExternalLink size={15} aria-hidden="true" /></a>
        </div>
      </aside>
    </div>
  );
}

function ImageUpload({ inputRef, busy, onUpload }: { inputRef: React.RefObject<HTMLInputElement>; busy: boolean; onUpload: (file?: File) => void }) {
  return <div className="store-cover-upload"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Upload storefront image" onChange={(e) => onUpload(e.target.files?.[0])} /><button className="btn btn-outline" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Uploading image…" : "Upload image"}</button><small className="field-hint">JPG, PNG, WebP or AVIF · up to 5 MB</small></div>;
}

export default function StoreDesign() {
  return <DashboardShell seo={PAGE_META.dashboardDesign} title="Store design">{(me) => me.store ? <DesignForm me={me} /> : <Alert kind="info">Complete store setup first to customize your public storefront.</Alert>}</DashboardShell>;
}
