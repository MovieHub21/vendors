import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Plus, Redo2, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { DocumentView } from "../components/DocumentView";
import { PAGE_META } from "../data/pageMeta";
import { sampleDoc, TAGS, type BankDetails } from "../lib/docContent";
import {
  ALIGNS,
  BLOCK_LABELS,
  effectiveStyle,
  FONT_KEYS,
  FONT_WEIGHTS,
  MAX_BLOCKS,
  newBlock,
  PAGE_H,
  PAGE_W,
  validateTemplate,
  type Block,
  type BlockStyle,
  type BlockType,
  type DocKind,
  type FontKey,
  type Template,
} from "../lib/docTemplate";
import {
  builtInTemplate,
  loadPaymentDetails,
  loadTemplate,
  resetTemplate,
  saveTemplate,
  savePaymentDetails,
} from "../services/documents";

const SECTION_TYPES: BlockType[] = ["brand", "logo", "store", "title", "order", "customer", "items", "totals", "payments", "bank"];
const BASIC_TYPES: BlockType[] = ["text", "image", "line", "box"];
const HEADING_TYPES: BlockType[] = ["title", "order", "customer", "bank", "payments"];
const ACCENT_TYPES: BlockType[] = ["brand", "title", "order", "customer", "bank", "payments"];
const TEXT_TYPES: BlockType[] = ["brand", "store", "title", "order", "customer", "items", "totals", "payments", "bank", "text"];
const ALIGN_TYPES: BlockType[] = ["brand", "store", "title", "order", "customer", "bank", "text", "payments"];
const FONT_LABELS: Record<FontKey, string> = { sans: "Modern (DM Sans)", display: "Bold (Manrope)", serif: "Classic (Serif)", mono: "Typewriter" };

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];
type DragMode = "move" | Handle;
const HANDLE_POS: Record<Handle, [number, number]> = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
const HANDLE_CURSOR: Record<Handle, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

interface Geom {
  x: number;
  y: number;
  w: number;
  h: number;
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function dragGeometry(mode: DragMode, o: Geom, dx: number, dy: number, minH: number): Geom {
  const MIN_W = 12;
  if (mode === "move") return { ...o, x: Math.round(clamp(o.x + dx, 0, PAGE_W - o.w)), y: Math.round(clamp(o.y + dy, 0, PAGE_H - o.h)) };
  let { x, y, w, h } = o;
  if (mode.includes("e")) w = clamp(o.w + dx, MIN_W, PAGE_W - o.x);
  if (mode.includes("s")) h = clamp(o.h + dy, minH, PAGE_H - o.y);
  if (mode.includes("w")) {
    x = clamp(o.x + dx, 0, o.x + o.w - MIN_W);
    w = o.w + (o.x - x);
  }
  if (mode.includes("n")) {
    y = clamp(o.y + dy, 0, o.y + o.h - minH);
    h = o.h + (o.y - y);
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

const toHex6 = (c: string) => (/^#[0-9a-f]{3}$/i.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : /^#[0-9a-f]{6}$/i.test(c) ? c : "#ffffff");

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="dz-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(clamp(Math.round(n), min, max));
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  );
}

function ColorField({ label, value, onChange, allowNone = false }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const none = value === "transparent";
  return (
    <div className="dz-field dz-color">
      <span>{label}</span>
      <div>
        <input type="color" aria-label={label} value={toHex6(value)} onChange={(e) => onChange(e.target.value)} className={none ? "is-none" : undefined} />
        {allowNone && (
          <button type="button" className={`dz-chip${none ? " on" : ""}`} onClick={() => onChange(none ? "#ffffff" : "transparent")}>
            {none ? "None ✓" : "None"}
          </button>
        )}
      </div>
    </div>
  );
}

const makeId = (taken: Set<string>) => {
  let id = "";
  do id = Math.random().toString(36).slice(2, 8);
  while (id.length < 6 || taken.has(id));
  return id;
};

const emptyBank: BankDetails = { bank_name: "", account_name: "", account_number: "", extra_note: "" };

function PaymentDetailsCard({ initial, onSaved }: { initial: BankDetails | null; onSaved: (b: BankDetails | null) => void }) {
  const [form, setForm] = useState<BankDetails>(initial ?? emptyBank);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof BankDetails, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await savePaymentDetails({
      bank_name: form.bank_name ?? "",
      account_name: form.account_name ?? "",
      account_number: form.account_number ?? "",
      extra_note: form.extra_note ?? "",
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const saved = r.data.details;
    setForm(saved ?? emptyBank);
    onSaved(saved);
    setNotice(saved ? "Account details saved. They now appear on your invoices." : "Account details removed.");
  };

  return (
    <section className="dash-card dz-payment" id="payment">
      <h2>Where customers should pay</h2>
      <p className="muted">These details are printed on every invoice (add the “Bank / payment details” block to a design to place them). Leave everything blank to hide them.</p>
      <div className="dz-payment-grid">
        <label className="dz-field"><span>Bank name</span><input value={form.bank_name ?? ""} maxLength={80} onChange={(e) => set("bank_name", e.target.value)} placeholder="e.g. GTBank" /></label>
        <label className="dz-field"><span>Account name</span><input value={form.account_name ?? ""} maxLength={120} onChange={(e) => set("account_name", e.target.value)} placeholder="Name on the account" /></label>
        <label className="dz-field"><span>Account number</span><input value={form.account_number ?? ""} maxLength={30} inputMode="numeric" onChange={(e) => set("account_number", e.target.value)} placeholder="0123456789" /></label>
        <label className="dz-field dz-wide"><span>Anything else customers need (optional)</span><textarea rows={2} maxLength={300} value={form.extra_note ?? ""} onChange={(e) => set("extra_note", e.target.value)} placeholder="e.g. Opay 0801 234 5678 · send proof of payment on WhatsApp" /></label>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save account details"}</button>
    </section>
  );
}

function Designer() {
  const [drafts, setDrafts] = useState<Record<DocKind, Template> | null>(null);
  const [saved, setSaved] = useState<Record<DocKind, boolean>>({ receipt: false, invoice: false });
  const [dirty, setDirty] = useState<Record<DocKind, boolean>>({ receipt: false, invoice: false });
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [kind, setKind] = useState<DocKind>("receipt");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<Template[]>([]);
  const [future, setFuture] = useState<Template[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(1);

  const draftsRef = useRef<Record<DocKind, Template> | null>(null);
  const scaleRef = useRef(1);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => () => stopDrag.current?.(), []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadTemplate("receipt"), loadTemplate("invoice"), loadPaymentDetails()]).then(([r, i, b]) => {
      if (cancelled) return;
      if (!r.ok || !i.ok) {
        setLoadError("We couldn't load your designs. If the app was just updated, make sure the latest database update (0700) has been run.");
        return;
      }
      const loaded = { receipt: r.data.template, invoice: i.data.template };
      draftsRef.current = loaded;
      setDrafts(loaded);
      setSaved({ receipt: !r.data.isDefault, invoice: !i.data.isDefault });
      setBank(b.ok ? b.data : null);
      if (window.location.hash === "#payment") window.setTimeout(() => document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" }), 150);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dirty.receipt && !dirty.invoice) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const template = drafts?.[kind] ?? null;
  const selected = template?.blocks.find((b) => b.id === selectedId) ?? null;
  const preview = useMemo(() => sampleDoc(kind, bank), [kind, bank]);

  // ---------------------------------------------------------------- editing

  function setDraft(next: Template, markDirty = true) {
    if (!draftsRef.current) return;
    draftsRef.current = { ...draftsRef.current, [kind]: next };
    setDrafts(draftsRef.current);
    if (markDirty) setDirty((d) => ({ ...d, [kind]: true }));
    setNotice(null);
  }
  function update(fn: (t: Template) => Template, record = true) {
    const current = draftsRef.current?.[kind];
    if (!current) return;
    const next = fn(current);
    if (next === current) return;
    if (record) {
      setPast((p) => [...p.slice(-49), current]);
      setFuture([]);
    }
    setDraft(next);
  }
  const patchBlock = (id: string, patch: Partial<Block>, record = true) =>
    update((t) => ({ ...t, blocks: t.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), record);
  const patchStyle = (patch: BlockStyle) => selected && patchBlock(selected.id, { style: { ...selected.style, ...patch } });

  const undo = () => {
    const previous = past[past.length - 1];
    const current = draftsRef.current?.[kind];
    if (!previous || !current) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f]);
    setDraft(previous);
  };
  const redo = () => {
    const next = future[0];
    const current = draftsRef.current?.[kind];
    if (!next || !current) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current]);
    setDraft(next);
  };

  function addBlock(type: BlockType) {
    if (!template) return;
    if (template.blocks.length >= MAX_BLOCKS) {
      setError(`A design can have at most ${MAX_BLOCKS} blocks.`);
      return;
    }
    setError(null);
    const step = template.blocks.length % 10;
    const block = newBlock(type, makeId(new Set(template.blocks.map((b) => b.id))), 48 + step * 14, 60 + step * 26);
    update((t) => ({ ...t, blocks: [...t.blocks, block] }));
    setSelectedId(block.id);
  }
  function removeSelected() {
    if (!selected) return;
    update((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== selected.id) }));
    setSelectedId(null);
  }
  function duplicateSelected() {
    if (!selected || !template || template.blocks.length >= MAX_BLOCKS) return;
    const copy: Block = { ...selected, id: makeId(new Set(template.blocks.map((b) => b.id))), x: Math.min(selected.x + 16, PAGE_W - selected.w), y: Math.min(selected.y + 16, PAGE_H - selected.h), style: { ...selected.style } };
    update((t) => ({ ...t, blocks: [...t.blocks, copy] }));
    setSelectedId(copy.id);
  }
  function moveLayer(direction: -1 | 1) {
    if (!selected) return;
    update((t) => {
      const i = t.blocks.findIndex((b) => b.id === selected.id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= t.blocks.length) return t;
      const blocks = [...t.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...t, blocks };
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, block: Block, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(block.id);
    stopDrag.current?.();
    const origin: Geom = { x: block.x, y: block.y, w: block.w, h: block.h };
    const startX = event.clientX;
    const startY = event.clientY;
    const minH = block.type === "line" ? 1 : 12;
    let moved = false;
    const onMove = (e: PointerEvent) => {
      const k = scaleRef.current || 1;
      const next = dragGeometry(mode, origin, (e.clientX - startX) / k, (e.clientY - startY) / k, minH);
      if (!moved && (next.x !== origin.x || next.y !== origin.y || next.w !== origin.w || next.h !== origin.h)) {
        moved = true;
        const current = draftsRef.current?.[kind];
        if (current) {
          setPast((p) => [...p.slice(-49), current]);
          setFuture([]);
        }
      }
      if (moved) patchBlock(block.id, next, false);
    };
    const end = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stopDrag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stopDrag.current = end;
  }

  // keyboard: arrows nudge, Delete removes, Ctrl+Z / Ctrl+Y undo and redo, Ctrl+D duplicates
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        duplicateSelected();
      } else if (selected && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        removeSelected();
      } else if (selected && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patchBlock(selected.id, { x: clamp(selected.x + dx, 0, PAGE_W - selected.w), y: clamp(selected.y + dy, 0, PAGE_H - selected.h) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- saving

  async function save() {
    const current = draftsRef.current?.[kind];
    if (!current) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await saveTemplate(kind, current);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    try {
      setDraft(validateTemplate(r.data.template.layout), false);
    } catch {
      /* keep what is on screen */
    }
    setDirty((d) => ({ ...d, [kind]: false }));
    setSaved((s) => ({ ...s, [kind]: true }));
    setNotice(`Saved. Every ${kind} you open or share now uses this design, including earlier ones.`);
  }
  async function reset() {
    if (!window.confirm(`Go back to the standard ${kind} design? Your saved design will be removed.`)) return;
    setBusy(true);
    setError(null);
    if (saved[kind]) {
      const r = await resetTemplate(kind);
      if (!r.ok) {
        setBusy(false);
        setError(r.message);
        return;
      }
    }
    setBusy(false);
    setDraft(builtInTemplate(kind).template, false);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setDirty((d) => ({ ...d, [kind]: false }));
    setSaved((s) => ({ ...s, [kind]: false }));
    setNotice("Back to the standard design.");
  }
  function switchKind(next: DocKind) {
    if (next === kind) return;
    setKind(next);
    setSelectedId(null);
    setPast([]);
    setFuture([]);
    setNotice(null);
    setError(null);
  }

  if (loadError) return <Alert kind="error">{loadError}</Alert>;
  if (!drafts || !template) return <p className="auth-loading" role="status">Loading your designs…</p>;

  const style = selected ? effectiveStyle(selected) : null;
  const hasText = selected ? TEXT_TYPES.includes(selected.type) : false;
  const minHeight = selected?.type === "line" ? 1 : 12;

  return (
    <div className="designer">
      <div className="dz-toolbar">
        <div className="dz-tabs" role="tablist" aria-label="Document type">
          {(["receipt", "invoice"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={`dz-tab${kind === k ? " on" : ""}`} onClick={() => switchKind(k)}>
              {k === "receipt" ? "Receipt" : "Invoice"}
              {dirty[k] && <i aria-label="unsaved changes" />}
            </button>
          ))}
        </div>
        <div className="dz-actions">
          <button className="btn btn-outline" onClick={undo} disabled={past.length === 0} aria-label="Undo"><Undo2 size={16} aria-hidden="true" /></button>
          <button className="btn btn-outline" onClick={redo} disabled={future.length === 0} aria-label="Redo"><Redo2 size={16} aria-hidden="true" /></button>
          <button className="btn btn-outline" onClick={() => void reset()} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Standard design</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !dirty[kind]}><Save size={16} aria-hidden="true" /> {busy ? "Saving…" : "Save design"}</button>
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <p className="muted dz-hint">
        Add blocks, drag them where you want them and pull the corners to resize. Pick a block to change its colours, text and size. The picture below uses sample details; real
        orders fill in automatically, and the items table pushes everything under it down as it grows.
      </p>

      <div className="dz-layout">
        <aside className="dz-palette dash-card" aria-label="Blocks">
          <h3>Document sections</h3>
          <div className="dz-add">
            {SECTION_TYPES.map((t) => (
              <button key={t} className="dz-add-btn" onClick={() => addBlock(t)}><Plus size={14} aria-hidden="true" /> {BLOCK_LABELS[t]}</button>
            ))}
          </div>
          <h3>Basics</h3>
          <div className="dz-add">
            {BASIC_TYPES.map((t) => (
              <button key={t} className="dz-add-btn" onClick={() => addBlock(t)}><Plus size={14} aria-hidden="true" /> {BLOCK_LABELS[t]}</button>
            ))}
          </div>
          <h3>On this page</h3>
          <ul className="dz-layers">
            {[...template.blocks].reverse().map((b) => (
              <li key={b.id}>
                <button className={b.id === selectedId ? "on" : undefined} onClick={() => setSelectedId(b.id)}>
                  {BLOCK_LABELS[b.type]}
                  {b.type === "text" && b.text ? ` · ${b.text.slice(0, 16)}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="dz-stage" onPointerDown={() => setSelectedId(null)}>
          <DocumentView template={template} doc={preview} editing={{ onBlockPointerDown: (e, block) => startDrag(e, block, "move") }} onScale={setScale}>
            {selected && (
              <div className="doc-sel" style={{ left: selected.x, top: selected.y, width: selected.w, height: selected.h }}>
                {HANDLES.map((h) => (
                  <span
                    key={h}
                    className="doc-handle"
                    style={{ left: `${HANDLE_POS[h][0]}%`, top: `${HANDLE_POS[h][1]}%`, cursor: HANDLE_CURSOR[h], transform: `translate(-50%, -50%) scale(${1 / (scale || 1)})` }}
                    onPointerDown={(e) => startDrag(e, selected, h)}
                  />
                ))}
              </div>
            )}
          </DocumentView>
        </div>

        <aside className="dz-inspector dash-card" aria-label="Block settings">
          {!selected || !style ? (
            <>
              <h3>Page</h3>
              <ColorField label="Page colour" value={template.background} onChange={(v) => update((t) => ({ ...t, background: v }))} />
              <p className="muted">Select a block on the page to change it.</p>
            </>
          ) : (
            <>
              <h3>{BLOCK_LABELS[selected.type]}</h3>
              <div className="dz-row dz-layer">
                <button className="btn btn-outline" onClick={() => moveLayer(1)} aria-label="Bring forward" title="Bring forward"><ArrowUp size={15} aria-hidden="true" /></button>
                <button className="btn btn-outline" onClick={() => moveLayer(-1)} aria-label="Send backward" title="Send backward"><ArrowDown size={15} aria-hidden="true" /></button>
                <button className="btn btn-outline" onClick={duplicateSelected} aria-label="Duplicate" title="Duplicate"><Copy size={15} aria-hidden="true" /></button>
                <button className="btn btn-outline dz-danger" onClick={removeSelected} aria-label="Delete block" title="Delete"><Trash2 size={15} aria-hidden="true" /></button>
              </div>

              {selected.type === "text" && (
                <label className="dz-field">
                  <span>Text</span>
                  <textarea rows={4} maxLength={600} value={selected.text ?? ""} onChange={(e) => patchBlock(selected.id, { text: e.target.value })} />
                  <small>Tap to insert details that fill in by themselves:</small>
                  <div className="dz-tags">
                    {TAGS.map(([tag, label]) => (
                      <button key={tag} type="button" className="dz-chip" onClick={() => patchBlock(selected.id, { text: `${selected.text ?? ""}{{${tag}}}`.slice(0, 600) })}>{label}</button>
                    ))}
                  </div>
                </label>
              )}
              {HEADING_TYPES.includes(selected.type) && (
                <label className="dz-field">
                  <span>Heading (optional)</span>
                  <input value={selected.text ?? ""} maxLength={40} placeholder="Leave blank for the standard heading" onChange={(e) => patchBlock(selected.id, { text: e.target.value || undefined })} />
                </label>
              )}
              {selected.type === "image" && (
                <label className="dz-field">
                  <span>Image link (https://…)</span>
                  <input value={selected.src ?? ""} maxLength={500} placeholder="https://" onChange={(e) => patchBlock(selected.id, { src: e.target.value })} />
                </label>
              )}
              {selected.type === "logo" && <p className="muted">Shows your store logo from Store design. Nothing appears if you haven't added one.</p>}

              <h4>Position &amp; size</h4>
              <div className="dz-grid2">
                <NumberField label="Left" value={selected.x} min={0} max={PAGE_W - 8} onChange={(v) => patchBlock(selected.id, { x: Math.min(v, PAGE_W - selected.w) })} />
                <NumberField label="Top" value={selected.y} min={0} max={PAGE_H - 1} onChange={(v) => patchBlock(selected.id, { y: Math.min(v, PAGE_H - selected.h) })} />
                <NumberField label="Width" value={selected.w} min={8} max={PAGE_W} onChange={(v) => patchBlock(selected.id, { w: Math.min(v, PAGE_W - selected.x) })} />
                <NumberField label="Height" value={selected.h} min={minHeight} max={PAGE_H} onChange={(v) => patchBlock(selected.id, { h: Math.min(v, PAGE_H - selected.y) })} />
              </div>

              {hasText && (
                <>
                  <h4>Text</h4>
                  <label className="dz-field">
                    <span>Font</span>
                    <select value={style.font} onChange={(e) => patchStyle({ font: e.target.value as FontKey })}>
                      {FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
                    </select>
                  </label>
                  <div className="dz-grid2">
                    <NumberField label="Size" value={style.fontSize} min={8} max={72} onChange={(v) => patchStyle({ fontSize: v })} />
                    <label className="dz-field">
                      <span>Weight</span>
                      <select value={style.fontWeight} onChange={(e) => patchStyle({ fontWeight: Number(e.target.value) })}>
                        {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w === 400 ? "Light" : w === 500 ? "Regular" : w === 600 ? "Medium" : w === 700 ? "Bold" : "Extra bold"}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="dz-row">
                    {ALIGN_TYPES.includes(selected.type) && ALIGNS.map((a) => (
                      <button key={a} className={`btn btn-outline${style.align === a ? " dz-on" : ""}`} onClick={() => patchStyle({ align: a })} aria-label={`Align ${a}`} aria-pressed={style.align === a}>
                        {a === "left" ? <AlignLeft size={15} aria-hidden="true" /> : a === "center" ? <AlignCenter size={15} aria-hidden="true" /> : <AlignRight size={15} aria-hidden="true" />}
                      </button>
                    ))}
                    <button className={`btn btn-outline${style.italic ? " dz-on" : ""}`} onClick={() => patchStyle({ italic: !style.italic })} aria-pressed={style.italic}><i>I</i></button>
                    {selected.type === "text" && <button className={`btn btn-outline${style.uppercase ? " dz-on" : ""}`} onClick={() => patchStyle({ uppercase: !style.uppercase })} aria-pressed={style.uppercase}>AA</button>}
                  </div>
                  <ColorField label="Text colour" value={style.color} onChange={(v) => patchStyle({ color: v })} />
                  {ACCENT_TYPES.includes(selected.type) && <ColorField label={selected.type === "brand" ? "“Sharp” colour" : "Heading colour"} value={style.accent} onChange={(v) => patchStyle({ accent: v })} />}
                </>
              )}

              {selected.type === "items" && (
                <>
                  <h4>Table colours</h4>
                  <ColorField label="Header background" value={style.headBg} onChange={(v) => patchStyle({ headBg: v })} allowNone />
                  <ColorField label="Header text" value={style.headColor} onChange={(v) => patchStyle({ headColor: v })} />
                  <ColorField label="Alternate rows" value={style.stripe} onChange={(v) => patchStyle({ stripe: v })} allowNone />
                  <ColorField label="Row lines" value={style.lineColor} onChange={(v) => patchStyle({ lineColor: v })} />
                </>
              )}

              {selected.type === "line" ? (
                <ColorField label="Line colour" value={style.color} onChange={(v) => patchStyle({ color: v })} />
              ) : (
                <>
                  <h4>Box</h4>
                  <ColorField label="Background" value={style.bg} onChange={(v) => patchStyle({ bg: v })} allowNone />
                  <div className="dz-grid2">
                    <NumberField label="Padding" value={style.padding} min={0} max={60} onChange={(v) => patchStyle({ padding: v })} />
                    <NumberField label="Corners" value={style.radius} min={0} max={200} onChange={(v) => patchStyle({ radius: v })} />
                    <NumberField label="Border" value={style.borderWidth} min={0} max={12} onChange={(v) => patchStyle({ borderWidth: v })} />
                    <NumberField label="Opacity %" value={style.opacity} min={5} max={100} onChange={(v) => patchStyle({ opacity: v })} />
                  </div>
                  {style.borderWidth > 0 && <ColorField label="Border colour" value={style.borderColor} onChange={(v) => patchStyle({ borderColor: v })} />}
                </>
              )}
            </>
          )}
        </aside>
      </div>

      <PaymentDetailsCard initial={bank} onSaved={setBank} />
    </div>
  );
}

export default function DocumentDesigner() {
  return (
    <DashboardShell seo={PAGE_META.dashboardTemplates} title="Receipt & invoice design">
      {() => <Designer />}
    </DashboardShell>
  );
}
