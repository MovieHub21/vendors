import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";

const COPY = {
  login: {
    meta: PAGE_META.login,
    title: (
      <>
        Welcome
        <br />
        <em>back soon.</em>
      </>
    ),
    body: "Vendor sign-in will be connected in the next development phase.",
  },
  signup: {
    meta: PAGE_META.signup,
    title: (
      <>
        Your store starts
        <br />
        <em>here soon.</em>
      </>
    ),
    body: "Vendor registration and store setup are part of the next development phase. For now, explore the product preview.",
  },
  forgotPassword: {
    meta: PAGE_META.forgotPassword,
    title: (
      <>
        Password reset
        <br />
        <em>is on the way.</em>
      </>
    ),
    body: "Resetting a vendor password will be connected together with sign-in in the next development phase.",
  },
} as const;

/** Placeholder until Phase 2 (auth). Always noindex: a "coming soon" page should not appear in search. */
export default function AuthPlaceholder({ mode }: { mode: keyof typeof COPY }) {
  const { meta, title, body } = COPY[mode];
  return (
    <>
      <Seo seo={{ ...meta, noindex: true }} />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">PHASE 2</span>
          <h1>{title}</h1>
          <p>{body}</p>
          <Link to="/" className="btn btn-primary">
            Back to homepage <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
