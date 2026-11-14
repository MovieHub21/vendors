import { useState, type FormEvent } from "react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { PAGE_META } from "../data/pageMeta";
import { submitSupportRequest, type Me } from "../services/api";

function VendorComplaintForm({ me }: { me: Me }) {
  const [name, setName] = useState(me.profile?.full_name || "");
  const [email, setEmail] = useState(me.user.email || "");
  const [phone, setPhone] = useState(me.profile?.phone || me.store?.contact_phone || "");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await submitSupportRequest({
      request_type: "vendor_complaint", name, email, phone,
      topic: `Vendor complaint: ${topic}`, message,
    });
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  };

  return <>
    <section className="dash-card vendor-support-intro"><p className="vendor-page-eyebrow">SELLSHARP SUPPORT</p><h2>How can we help?</h2><p>Send a complaint or raise an issue with your account, store or subscription. The SellSharp team will review it in the management inbox.</p>{me.store && <small>Store: <strong>{me.store.name}</strong> · /{me.store.slug}</small>}</section>
    {sent ? <section className="dash-card vendor-support-success" role="status"><h2>Your message has been sent</h2><p>We’ve added it to the SellSharp support inbox. You can return here if you need to send another request.</p><button type="button" className="btn btn-outline" onClick={() => { setSent(false); setMessage(""); setTopic(""); }}>Send another message</button></section> : <form className="dash-card vendor-support-form" onSubmit={(event) => void submit(event)}>
      <div className="vendor-support-form-heading"><div><h2>Contact the SellSharp team</h2><p>Your contact details and store are attached to the request.</p></div></div>
      <div className="vendor-support-fields">
        <Field label="Your name" autoComplete="name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Email address" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Phone number with country code" type="tel" autoComplete="tel" minLength={5} maxLength={30} required value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label className="field"><span>What is this about?</span><select required value={topic} onChange={(event) => setTopic(event.target.value)}><option value="" disabled>Select a topic</option><option>Complaint about SellSharp</option><option>Subscription or payment</option><option>Store or product issue</option><option>Something else</option></select></label>
        <label className="field vendor-support-message"><span>Tell us what happened</span><textarea required minLength={5} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Include any details that will help us review your request." /></label>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send to SellSharp support"}</button>
    </form>}
  </>;
}

export default function VendorSupport() {
  return <DashboardShell seo={{ ...PAGE_META.vendorSupport, noindex: true }} title="Contact support" allowIncomplete>{(me) => <VendorComplaintForm me={me} />}</DashboardShell>;
}
