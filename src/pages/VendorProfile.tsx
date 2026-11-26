import { ExternalLink, Settings2, Store, UserRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DashboardShell } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { storePath } from "../lib/routes";
import type { Me } from "../services/api";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="vendor-profile-detail"><span>{label}</span><strong>{children || "Not added"}</strong></div>;
}

function ProfileContent({ me }: { me: Me }) {
  const store = me.store;
  const billing = me.billing;
  const subscription = me.subscription;
  const socialLinks = store ? [
    ["Instagram", store.instagram_url], ["Facebook", store.facebook_url], ["TikTok", store.tiktok_url],
    ["YouTube", store.youtube_url], ["X", store.x_url], ["Threads", store.threads_url],
    ["Snapchat", store.snapchat_url], ["Pinterest", store.pinterest_url], ["LinkedIn", store.linkedin_url],
    [store.other_social_label || "Other social link", store.other_social_url],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])) : [];
  const renews = subscription?.current_period_end ?? billing?.period_end;
  const billingState = billing?.state?.replaceAll("_", " ") ?? subscription?.status ?? "No subscription";

  return <div className="vendor-profile-page">
    <section className="dash-card vendor-profile-card">
      <div className="vendor-profile-card-heading"><span className="vendor-profile-icon"><UserRound size={19} aria-hidden="true" /></span><div><h2>Your account</h2><p>Your sign-in and contact details.</p></div></div>
      <div className="vendor-profile-grid">
        <Detail label="Full name">{me.profile?.full_name?.trim()}</Detail>
        <Detail label="Email address">{me.user.email}</Detail>
        <Detail label="Phone number">{me.profile?.phone}</Detail>
      </div>
    </section>

    <section className="dash-card vendor-profile-card">
      <div className="vendor-profile-card-heading"><span className="vendor-profile-icon"><Store size={19} aria-hidden="true" /></span><div><h2>Your store</h2><p>Details customers see when they visit your storefront.</p></div></div>
      {!store ? <div className="vendor-profile-empty"><p>Your store setup is not complete yet.</p><Link className="btn btn-primary" to="/onboarding">Set up your store</Link></div> : <>
        <div className="vendor-profile-store-banner">
          <div><span className={`vendor-profile-status${store.is_published && store.status === "active" ? " is-live" : ""}`}><i aria-hidden="true" />{store.is_published && store.status === "active" ? "Live" : store.status === "suspended" ? "Suspended" : "Not published"}</span><h3>{store.name}</h3><a href={storePath(store.slug)} target="_blank" rel="noreferrer">{window.location.host}/{store.slug}<ExternalLink size={13} aria-hidden="true" /></a></div>
          <Link className="btn btn-outline vendor-profile-visit" to={storePath(store.slug)} target="_blank">View store</Link>
        </div>
        <div className="vendor-profile-grid">
          <Detail label="Store name">{store.name}</Detail>
          <Detail label="Store username">/{store.slug}</Detail>
          <Detail label="Business category">{store.category}</Detail>
          <Detail label="Location">{[store.city, store.state].filter(Boolean).join(", ")}</Detail>
          <Detail label="Store phone">{store.contact_phone}</Detail>
          <Detail label="Store email">{store.contact_email}</Detail>
          <Detail label="Tagline">{store.tagline}</Detail>
          <Detail label="Store layout">{store.storefront_layout}</Detail>
          <Detail label="Store description" ><span className="vendor-profile-long-value">{store.description}</span></Detail>
          <Detail label="Search title">{store.seo_title}</Detail>
          <Detail label="Search description"><span className="vendor-profile-long-value">{store.seo_description}</span></Detail>
          <Detail label="Search keywords">{store.seo_keywords}</Detail>
          <Detail label="Search visibility">{store.indexable ? "Enabled" : "Disabled"}</Detail>
          {socialLinks.map(([label, url]) => <Detail key={label} label={label}><a href={url} target="_blank" rel="noreferrer">{url}</a></Detail>)}
        </div>
        <div className="vendor-profile-actions"><Link className="btn btn-outline" to="/dashboard/design"><Settings2 size={16} aria-hidden="true" /> Edit store design</Link><Link className="btn btn-outline" to="/dashboard/seo">Store SEO</Link></div>
      </>}
    </section>

    <section className="dash-card vendor-profile-card">
      <div className="vendor-profile-card-heading"><span className="vendor-profile-icon"><Wallet size={19} aria-hidden="true" /></span><div><h2>Subscription</h2><p>Your SellSharp plan and renewal details.</p></div></div>
      <div className="vendor-profile-grid">
        <Detail label="Plan">{subscription?.plan_code}</Detail>
        <Detail label="Status">{billingState}</Detail>
        <Detail label="Renewal or end date">{renews ? new Date(renews).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "Not available"}</Detail>
        <Detail label="Automatic renewal">{billing ? billing.auto_renew ? "On" : "Off" : undefined}</Detail>
      </div>
      {billing?.state === "renewal_failed" && <p className="vendor-profile-note">Your last renewal did not go through. You can review billing on your dashboard.</p>}
    </section>
  </div>;
}

export default function VendorProfile() {
  return <DashboardShell seo={PAGE_META.dashboard} title="Profile">
    {(me) => <ProfileContent me={me} />}
  </DashboardShell>;
}
