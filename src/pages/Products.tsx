import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Eye, EyeOff, Image as ImageIcon, MessageCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { productPath } from "../lib/routes";
import { koboToInput, nairaToKobo, productShareMessage, whatsappLink } from "../lib/sales";
import { absoluteUrl } from "../lib/site";
import { supabase } from "../lib/supabase";
import { productAction, saveProduct } from "../services/sales";
import { listProducts, type ProductRow } from "../services/vendorData";

interface FormState {
  id?: string;
  name: string;
  price: string;
  description: string;
  category: string;
  stock: string; // "" = not tracked
  available: boolean;
  published: boolean;
  images: string; // one address per line
}
const EMPTY: FormState = { name: "", price: "", description: "", category: "", stock: "", available: true, published: true, images: "" };

const fromRow = (p: ProductRow): FormState => ({
  id: p.id,
  name: p.name,
  price: koboToInput(p.price_kobo),
  description: p.description,
  category: p.category ?? "",
  stock: p.stock_quantity === null ? "" : String(p.stock_quantity),
  available: p.is_available,
  published: p.status === "published",
  images: [...p.product_images].sort((a, b) => a.position - b.position).map((i) => i.url).join("\n"),
});

async function compressImage(file: File): Promise<File> {
  // Skip compression for small files (under 300 KB)
  if (file.size < 300 * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_W = 1920;
      let { width, height } = img;
      if (width > MAX_W) {
        height = Math.round((height * MAX_W) / width);
        width = MAX_W;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read image.")); };
    img.src = objectUrl;
  });
}

async function uploadProductPhoto(file: File): Promise<string> {
  if (!supabase) throw new Error("Backend storage is not configured.");
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = "product-images";
  const { error } = await supabase.storage.from(bucket).upload(filename, compressed, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new Error(
      "Storage bucket not found. Run the SQL in supabase/migrations/20261113000200_storage_buckets.sql in the Supabase SQL Editor to create it.",
    );
  }
  return supabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl;
}

function ProductForm({ initial, status, categories, onSaved, onCancel }: { initial: FormState; status?: ProductRow["status"]; categories: string[]; onSaved: (msg: string) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  const [addingCategory, setAddingCategory] = useState(Boolean(initial.category && !categories.some((category) => category.toLowerCase() === initial.category.toLowerCase())));
  const [newCategory, setNewCategory] = useState(addingCategory ? initial.category : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const imageList = useMemo(
    () => f.images.split("\n").map((s) => s.trim()).filter(Boolean),
    [f.images]
  );
  const categoryOptions = useMemo(() => {
    const options = [...categories];
    if (f.category && !options.some((category) => category.toLowerCase() === f.category.toLowerCase())) options.push(f.category);
    return options;
  }, [categories, f.category]);

  const updateImages = (urls: string[]) => set("images", urls.join("\n"));

  const handleAddUrl = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const url = newImageUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("Picture address must begin with https://");
      return;
    }
    if (imageList.length >= 8) {
      setError("You can add up to 8 pictures.");
      return;
    }
    updateImages([...imageList, url]);
    setNewImageUrl("");
    setError(null);
  };

  const handleRemoveImage = (index: number) => {
    updateImages(imageList.filter((_, i) => i !== index));
  };

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    const item = imageList[index];
    const rest = imageList.filter((_, i) => i !== index);
    updateImages([item, ...rest]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const slots = 8 - imageList.length;
    if (slots <= 0) {
      setError("You can add up to 8 pictures.");
      return;
    }
    const toUpload = files.slice(0, slots);
    setUploading(true);
    setUploadProgress(`Uploading 0 of ${toUpload.length}…`);
    setError(null);
    const urls: string[] = [];
    let done = 0;
    for (const file of toUpload) {
      try {
        const url = await uploadProductPhoto(file);
        urls.push(url);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to upload photo.";
        setError(`${msg} (You can paste a public https:// image link instead).`);
        break;
      }
      done++;
      setUploadProgress(`Uploading ${done} of ${toUpload.length}…`);
    }
    if (urls.length) updateImages([...imageList, ...urls]);
    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.name.trim().length < 2) return setError("Give the product a name (at least 2 letters).");
    if (addingCategory && !newCategory.trim()) return setError("Enter a name for the new category.");
    const price = nairaToKobo(f.price);
    if (!price || price < 1) return setError("Enter the price in naira, for example 25,000.");
    let stock: number | null = null;
    if (f.stock.trim() !== "") {
      if (!/^\d{1,7}$/.test(f.stock.trim())) return setError("Stock must be a whole number, or leave it empty if you don't count stock.");
      stock = Number(f.stock.trim());
    }
    const images = f.images.split("\n").map((s) => s.trim()).filter(Boolean);
    if (images.length > 8) return setError("You can add up to 8 pictures.");
    setBusy(true);
    const r = await saveProduct({
      product_id: f.id,
      name: f.name.trim(),
      price_kobo: price,
      description: f.description.trim(),
      category: addingCategory
        ? categories.find((category) => category.toLowerCase() === newCategory.trim().toLowerCase()) ?? newCategory.trim()
        : f.category.trim() || null,
      stock_quantity: stock,
      is_available: f.available,
      // A hidden (archived) product stays hidden unless the vendor ticks "Show in my store".
      status: f.published ? "published" : status === "archived" ? "archived" : "draft",
      images: images.map((url) => ({ url })),
    });
    setBusy(false);
    if (r.ok) onSaved(f.id ? "Product updated." : "Product added.");
    else setError(r.message);
  }

  return (
    <form className="dash-card" onSubmit={submit} noValidate>
      <h2>{f.id ? "Edit product" : "Add a product"}</h2>
      <Field label="Product name" value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
      <div className="field-row">
        <Field label="Price (₦)" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} />
        <div className="field">
          <label htmlFor="pf-category">Category (optional)</label>
          <select id="pf-category" value={addingCategory ? "__new_category__" : f.category} onChange={(e) => {
            if (e.target.value === "__new_category__") setAddingCategory(true);
            else { setAddingCategory(false); set("category", e.target.value); setNewCategory(""); }
          }}>
            <option value="">No category</option>
            {categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
            <option value="__new_category__">Add a new category…</option>
          </select>
          {addingCategory && <input className="new-category-input" aria-label="New category name" maxLength={40} value={newCategory} placeholder="Enter category name" onChange={(e) => setNewCategory(e.target.value)} />}
        </div>
      </div>
      <div className="field">
        <label htmlFor="pf-desc">Description</label>
        <textarea id="pf-desc" rows={4} maxLength={5000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <small className="field-hint">20+ characters helps this product show up on Google.</small>
      </div>
      <Field label="Stock quantity (optional)" inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value)} hint="Leave empty if you don't count stock. Stock goes down when a sale is confirmed." />
      <div className="field">
        <label>Product pictures ({imageList.length}/8)</label>
        <small className="field-hint product-photo-hint">
          First photo is the cover.
        </small>

        {imageList.length > 0 && (
          <div className="product-image-grid">
            {imageList.map((url, i) => (
              <div key={`${url}-${i}`} className={`product-img-tile${i === 0 ? " is-cover" : ""}`}>
                <img
                  src={url}
                  alt={`Product photo ${i + 1}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";
                  }}
                />
                <span className="img-badge">{i === 0 ? "Cover photo" : `#${i + 1}`}</span>
                <div className="img-tile-actions">
                  {i > 0 && (
                    <button
                      type="button"
                      className="img-action-btn"
                      title="Set as cover photo"
                      onClick={() => handleSetCover(i)}
                    >
                      Set cover
                    </button>
                  )}
                  <button
                    type="button"
                    className="img-action-btn img-remove-btn"
                    title="Remove picture"
                    onClick={() => handleRemoveImage(i)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {imageList.length < 8 && (
          <div className="image-uploader-box">
            <div className="image-url-add-row">
              <input
                type="url"
                placeholder="Paste public image link (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
              />
              <button type="button" className="btn btn-outline btn-small" onClick={() => handleAddUrl()}>
                Add URL
              </button>
            </div>
            <div className="image-upload-divider">
              <span>or</span>
            </div>
            <div className="image-file-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn btn-outline btn-small image-upload-button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                {uploading
                  ? (uploadProgress ?? "Uploading…")
                  : "Upload photos from device"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="product-form-options">
        <label className="check"><input type="checkbox" checked={f.available} onChange={(e) => set("available", e.target.checked)} /> In stock / available to order</label>
        <label className="check"><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Show in my store</label>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="quick-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ProductsView({ storeSlug }: { storeSlug: string }) {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ form: FormState; status?: ProductRow["status"] } | null>(params.get("new") ? { form: EMPTY } : null);

  const load = useCallback(async () => {
    const r = await listProducts();
    if (r.ok) setRows(r.data);
    else setError(r.message);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle) && !(p.category ?? "").toLowerCase().includes(needle)) return false;
      if (filter === "hidden") return p.status !== "published";
      if (filter === "low") return p.stock_quantity !== null && p.stock_quantity <= 5;
      if (filter === "out") return !p.is_available || p.stock_quantity === 0;
      return true;
    });
  }, [rows, q, filter]);
  const categories = useMemo(() => {
    const byNormalizedName = new Map<string, string>();
    for (const category of (rows ?? []).map((product) => product.category?.trim()).filter((value): value is string => Boolean(value))) {
      const normalized = category.toLocaleLowerCase();
      if (!byNormalizedName.has(normalized)) byNormalizedName.set(normalized, category);
    }
    return [...byNormalizedName.values()].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  async function act(p: ProductRow, action: "duplicate" | "hide" | "show" | "delete") {
    if (action === "delete" && !window.confirm(`Delete “${p.name}”? Past orders keep their details. This can't be undone.`)) return;
    setNotice(null);
    const r = await productAction(p.id, action);
    if (!r.ok) return setError(r.message);
    setError(null);
    setNotice({ duplicate: "Copy created as a draft. Edit it, then tick “Show in my store”.", hide: "Product hidden. It's no longer in your store or search results.", show: "Product is live in your store.", delete: "Product deleted." }[action]);
    await load();
  }

  const closeForm = () => {
    setEditing(null);
    if (params.get("new")) setParams({}, { replace: true });
  };

  return (
    <>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {editing && (
        <ProductForm
          key={editing.form.id ?? "new"}
          initial={editing.form}
          status={editing.status}
          categories={categories}
          onCancel={closeForm}
          onSaved={(m) => {
            setNotice(m);
            closeForm();
            void load();
          }}
        />
      )}
      <div className="dash-filters">
        <div className="field"><label htmlFor="pr-q">Search</label><input id="pr-q" placeholder="Name or category" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="pr-f">Show</label>
          <select id="pr-f" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All products</option><option value="hidden">Hidden or draft</option><option value="low">Low stock (5 or fewer)</option><option value="out">Out of stock</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ form: EMPTY })}><Plus size={16} aria-hidden="true" /> Add product</button>
      </div>
      {!rows && !error && <p className="auth-loading">Loading products…</p>}
      {rows && rows.length === 0 && <p className="empty dash-card">You haven't added any products. Add your first one so customers can order and your stock is tracked.</p>}
      {rows && rows.length > 0 && shown.length === 0 && <p className="empty dash-card">No products match.</p>}
      {shown.length > 0 && (
        <ul className="product-list">
          {shown.map((p) => {
            const url = absoluteUrl(productPath(storeSlug, p.slug));
            const outOfStock = !p.is_available || p.stock_quantity === 0;
            return (
              <li className="dash-card product-row" key={p.id}>
                <div className="product-row-media">
                  {p.product_images[0] ? (
                    <img
                      src={p.product_images[0].url}
                      alt={p.name}
                      width={68}
                      height={68}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <span className="product-noimg" aria-label="No image">
                      <ImageIcon size={20} aria-hidden="true" />
                    </span>
                  )}
                  {p.product_images.length > 1 && (
                    <span className="product-img-count">{p.product_images.length}</span>
                  )}
                </div>
                <div className="product-info">
                  <b>{p.name}</b>
                  <span>{formatNaira(p.price_kobo)} · {p.stock_quantity === null ? "stock not counted" : `${p.stock_quantity} in stock`}{outOfStock ? " · out of stock" : ""}</span>
                  <small>{p.status === "published" ? "Visible in store" : p.status === "archived" ? "Hidden" : "Draft (not visible)"}{p.category ? ` · ${p.category}` : ""}</small>
                </div>
                <div className="product-actions">
                  <button className="btn btn-outline btn-small" onClick={() => setEditing({ form: fromRow(p), status: p.status })}><Pencil size={14} aria-hidden="true" /> Edit</button>
                  <button className="btn btn-outline btn-small" onClick={() => void act(p, "duplicate")}><Copy size={14} aria-hidden="true" /> Duplicate</button>
                  {p.status === "published" ? (
                    <button className="btn btn-outline btn-small" onClick={() => void act(p, "hide")}><EyeOff size={14} aria-hidden="true" /> Hide</button>
                  ) : (
                    <button className="btn btn-outline btn-small" onClick={() => void act(p, "show")}><Eye size={14} aria-hidden="true" /> Show</button>
                  )}
                  {p.status === "published" && (
                    <a className="btn btn-outline btn-small" target="_blank" rel="noopener noreferrer" href={whatsappLink(productShareMessage(p.name, p.price_kobo, url))}>
                      <MessageCircle size={14} aria-hidden="true" /> Share
                    </a>
                  )}
                  <button className="btn btn-outline btn-small" onClick={() => void act(p, "delete")}><Trash2 size={14} aria-hidden="true" /> Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted"><Link to="/dashboard/seo">Control how your products look on Google →</Link></p>
    </>
  );
}

export default function Products() {
  return (
    <DashboardShell seo={PAGE_META.dashboardProducts} title="Products">
      {(me) => <ProductsView storeSlug={me.store!.slug} />}
    </DashboardShell>
  );
}
