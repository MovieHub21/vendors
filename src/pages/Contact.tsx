import { useState } from "react";
import { ArrowRight, CheckCircle2, FileText, MessageCircle } from "lucide-react";
import { PageHero } from "../components/PageHero";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { breadcrumbJsonLd } from "../lib/seo";
import { crumbs } from "../lib/crumbs";

export default function Contact() {
  const [sent, setSent] = useState(false);
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
              Send us a message and tell us what you need help with. This contact form is currently a frontend preview.
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
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <h3>Send a message</h3>
            <label>
              Your name
              <input required placeholder="e.g. Amara Okafor" />
            </label>
            <label>
              Email address
              <input required type="email" placeholder="you@example.com" />
            </label>
            <label>
              What can we help with?
              <select defaultValue="">
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
              <textarea required rows={4} placeholder="Tell us a little about what you need..." />
            </label>
            <button className="btn btn-primary btn-full" type="submit">
              {sent ? "Message noted in preview" : "Send message"} <ArrowRight size={16} />
            </button>
            {sent && (
              <p className="form-success">
                <CheckCircle2 size={15} /> This is a frontend demo. Message delivery will be connected later.
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
