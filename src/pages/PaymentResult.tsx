import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { storePath } from "../lib/routes";
import { SITE } from "../lib/site";
import { getMe, verifyPayment, type PaymentStatus } from "../services/api";

const RETRY_MS = 3000;
const MAX_ATTEMPTS = 6;

/** Paystack sends the vendor back here with ?reference=…; we confirm it server-side (never trusting the URL alone). */
export default function PaymentResult() {
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");
  const [outcome, setOutcome] = useState<PaymentStatus | "error" | "verifying">("verifying");
  const [message, setMessage] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const result = await verifyPayment(reference);
        if (cancelled) return;
        if (!result.ok) {
          setMessage(result.message);
          return setOutcome("error");
        }
        if (result.data.status === "pending" && attempt < MAX_ATTEMPTS) return setAttempt((n) => n + 1);
        setOutcome(result.data.status);
        if (result.data.status === "success") {
          const me = await getMe();
          if (!cancelled && me.ok) setSlug(me.data.store?.slug ?? null);
        }
      },
      attempt === 0 ? 0 : RETRY_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reference, attempt]);

  let body;
  if (!reference) {
    body = (
      <>
        <Alert kind="error">We couldn't find a payment to confirm.</Alert>
        <Link to="/onboarding" className="btn btn-primary btn-full">
          Back to setup
        </Link>
      </>
    );
  } else if (outcome === "success") {
    body = (
      <>
        <p className="pay-success">
          <CheckCircle2 size={36} />
        </p>
        <Alert kind="success">Payment confirmed. Your store is live.</Alert>
        {slug && (
          <p className="auth-fineprint">
            Your link:{" "}
            <Link to={storePath(slug)}>
              {SITE.url.replace(/^https?:\/\//, "")}/{slug}
            </Link>
          </p>
        )}
<<<<<<< HEAD
        <Link to="/dashboard" className="btn btn-primary btn-full">
=======
        <Link to="/app" className="btn btn-primary btn-full">
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
          Go to your dashboard <ArrowRight size={16} />
        </Link>
      </>
    );
  } else if (outcome === "failed") {
    body = (
      <>
        <Alert kind="error">The payment wasn't completed, so you haven't been charged.</Alert>
        <Link to="/onboarding" className="btn btn-primary btn-full">
          Try again
        </Link>
      </>
    );
  } else if (outcome === "error") {
    body = (
      <>
        <Alert kind="error">{message ?? "We couldn't confirm your payment."}</Alert>
        <button
          className="btn btn-primary btn-full"
          type="button"
          onClick={() => {
            setOutcome("verifying");
            setAttempt(0);
          }}
        >
          Check again
        </button>
      </>
    );
  } else if (outcome === "pending") {
    body = (
      <>
        <Alert kind="info">
          Your payment is still processing. If you've been charged, your store will go live shortly.
        </Alert>
        <button
          className="btn btn-primary btn-full"
          type="button"
          onClick={() => {
            setOutcome("verifying");
            setAttempt(0);
          }}
        >
          Check again
        </button>
      </>
    );
  } else {
    body = (
      <p className="auth-loading" role="status">
        Confirming your payment with Paystack…
      </p>
    );
  }

  return (
    <>
      <Seo seo={{ ...PAGE_META.onboardingPayment, noindex: true }} />
      <AuthLayout title="Your payment">{body}</AuthLayout>
    </>
  );
}
