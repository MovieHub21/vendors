import { useState } from "react";
import { ArrowRight, CheckCircle2, FileText, MessageCircle } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { breadcrumbJsonLd } from "../lib/seo";
import { crumbs } from "../lib/crumbs";
import { submitSupportRequest } from "../services/api";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", topic: "", message: "" });
  return (
    <>
      <Seo seo={{ ...PAGE_META.contact, jsonLd: [breadcrumbJsonLd(crumbs(PAGE_META.contact))] }} />
      <PageHero
        eyebrow="CONTACT"
        title={
          <>
            Let's talk about
            <br />
            <em>your business.</em>
          </>
        }
        body="Have a question, need a hand or want to tell us what would make SellSharp more useful? We'd like to hear from you."
      />
      <section className="section section-white">
        <div className="container contact-layout">
          <div className="contact-info">
            <span className="eyebrow">GET IN TOUCH</span>
            <h2>We're listening.</h2>
            <p>
              Send us a message and tell us what you need help with. Your request will go to the SellSharp support inbox.
            </p>
            <div className="contact-method">
              <span>
                <MessageCircle />
              </span>
              <div>
                <b>WhatsApp support</b>
                <small>Support contact will be published at launch.</small>
              </div>
            </div>
            <div className="contact-method">
              <span>
                <FileText />
              </span>
              <div>
                <b>General enquiries</b>
                <small>Use the message form and we'll get back to you.</small>
              </div>
            </div>
          </div>
          <form
            className="contact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const result = await submitSupportRequest(form);
              setBusy(false);
              if (result.ok) setSent(true);
              else setError(result.message);
            }}
          >
            <h3>Send a message</h3>
            <label>
              Your name
              <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amara Okafor" />
            </label>
            <label>
              Email address
              <input required maxLength={254} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              What can we help with?
              <select required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                <option value="" disabled>
                  Select a topic
                </option>
                <option>Getting started</option>
                <option>Pricing and payments</option>
                <option>Store setup</option>
                <option>Something else</option>
              </select>
            </label>
            <label>
              Message
              <textarea required minLength={5} maxLength={5000} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us a little about what you need..." />
            </label>
            <button className="btn btn-primary btn-full" type="submit" disabled={busy || sent}>
              {sent ? "Message sent" : busy ? "Sending…" : "Send message"} <ArrowRight size={16} />
            </button>
            {error && <p className="admin-error" role="alert">{error}</p>}
            {sent && (
              <p className="form-success">
                <CheckCircle2 size={15} /> Your message is in our support inbox. We’ll follow up by email.
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
