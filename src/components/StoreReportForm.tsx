import { useEffect, useState, type FormEvent } from "react";
import type { VendorStore } from "../types/store";
import { submitSupportRequest } from "../services/api";

export function StoreReportForm({ store }: { store: VendorStore }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await submitSupportRequest({
      request_type: "store_report", store_slug: store.slug, name, email, phone,
      topic: `Store report: ${topic}`, message: details.trim(),
    });
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  };

  return <>
    <button type="button" className="sf-report-trigger" onClick={() => { setOpen(true); setSent(false); setError(""); }}>Report this store</button>
    {open && <div className="sf-report-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="sf-report-dialog" role="dialog" aria-modal="true" aria-labelledby="sf-report-title">
        <div className="sf-report-head"><div><p>SELLSHARP SUPPORT</p><h2 id="sf-report-title">Report {store.name}</h2></div><button type="button" className="sf-report-close" onClick={() => setOpen(false)}>Close</button></div>
        {sent ? <div className="sf-report-success" role="status"><h3>Report received</h3><p>Thank you. The SellSharp team will review your report. Your contact details are attached so we can follow up if needed.</p><button type="button" className="sf-report-submit" onClick={() => setOpen(false)}>Done</button></div> : <>
          <p className="sf-report-copy">Tell us what happened. Your name, email and phone number will be sent privately to SellSharp support.</p>
          <form className="sf-report-form" onSubmit={(event) => void submit(event)}>
            <label>Your name<input required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
            <label>Email address<input required maxLength={254} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label>Phone number<input required minLength={5} maxLength={30} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Include your country code" /></label>
            <label>Reason for report<select required value={topic} onChange={(event) => setTopic(event.target.value)}><option value="" disabled>Select a reason</option><option>Misleading product or information</option><option>Suspicious activity or possible scam</option><option>Abusive or inappropriate content</option><option>Other concern</option></select></label>
            <label>What should we know?<textarea required minLength={5} maxLength={5000} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe your concern" /></label>
            {error && <p className="sf-report-error" role="alert">{error}</p>}
            <div className="sf-report-actions"><button type="button" className="sf-report-cancel" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="sf-report-submit" disabled={busy}>{busy ? "Sending report…" : "Send report"}</button></div>
          </form>
        </>}
      </section>
    </div>}
  </>;
}
