import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Field, SelectField } from "../components/Field";
import { Seo } from "../components/Seo";
import { NIGERIAN_STATES, STORE_CATEGORIES } from "../data/nigeria";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { slugify, validateStoreSlug } from "../lib/reservedSlugs";
import { SITE } from "../lib/site";
import { SLUG_MESSAGES, validateStoreName } from "../lib/validation";
import { checkSlug, createStore, getMe, startSubscription, type Me } from "../services/api";

function Steps({ current }: { current: 1 | 2 }) {
  const steps = ["Account", "Your store", "Subscribe"];
  return (
    <ol className="onb-steps" aria-label="Setup progress">
      {steps.map((label, i) => (
        <li
          key={label}
          className={i < current ? "done" : i === current ? "current" : ""}
          aria-current={i === current ? "step" : undefined}
        >
          <span>{i < current ? <Check size={13} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function StoreStep({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<{ slug: string; available: boolean; reason?: string } | null>(null);

  const local = slug ? validateStoreSlug(slug) : null;
  const localOk = local?.ok === true;
  const cleanSlug = localOk ? local.slug : "";

  // Ask the server whether the username is free, shortly after the vendor stops typing.
  useEffect(() => {
    if (!cleanSlug) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await checkSlug(cleanSlug);
      if (!cancelled && result.ok) setChecked(result.data);
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cleanSlug]);

  const serverAnswer = checked && checked.slug === cleanSlug ? checked : null;
  let slugState: "idle" | "invalid" | "checking" | "available" | "unavailable" = "idle";
  let slugMessage: string | null = null;
  if (slug && local && !local.ok) {
    slugState = "invalid";
    slugMessage = SLUG_MESSAGES[local.reason];
  } else if (cleanSlug) {
    if (!serverAnswer) slugState = "checking";
    else if (serverAnswer.available) slugState = "available";
    else {
      slugState = "unavailable";
      slugMessage = SLUG_MESSAGES[serverAnswer.reason ?? "taken"] ?? SLUG_MESSAGES.taken;
    }
  }

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value).slice(0, 30));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      name: validateStoreName(name),
      slug: !slug ? "Choose a store username." : slugMessage,
      category: category ? null : "Choose a category.",
      state: state ? null : "Choose your state.",
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean) || slugState === "checking") return;
    setBusy(true);
    const result = await createStore({
      name: name.trim(),
      slug: cleanSlug,
      category,
      state,
      city: city.trim() || undefined,
    });
    setBusy(false);
    if (result.ok) return onCreated();
    if (result.code === "store_exists") return onCreated();
    if (result.code === "slug_taken") setChecked({ slug: cleanSlug, available: false, reason: "taken" });
    setFormError(result.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field
        label="Business name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={errors.name}
        placeholder="e.g. Ama Hair Studio"
        maxLength={80}
      />
      <Field
        label="Store username"
        prefix={`${SITE.url.replace(/^https?:\/\//, "")}/`}
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
        error={slugMessage ?? errors.slug}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={30}
        hint={
          slugState === "checking" ? (
            "Checking…"
          ) : slugState === "available" ? (
            <span className="slug-ok">
              <Check size={13} /> {cleanSlug} is available
            </span>
          ) : (
            "This is your store link. It can't be changed later."
          )
        }
      />
      <SelectField
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        error={errors.category}
      >
        <option value="" disabled>
          Choose a category
        </option>
        {STORE_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </SelectField>
      <div className="field-row">
        <SelectField label="State" value={state} onChange={(e) => setState(e.target.value)} error={errors.state}>
          <option value="" disabled>
            Choose a state
          </option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <Field label="City / area (optional)" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
      </div>
      {formError && <Alert kind="error">{formError}</Alert>}
      <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
        {busy ? "Creating your store…" : "Continue"} <ArrowRight size={16} />
      </button>
    </form>
  );
}

function SubscribeStep({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const result = await startSubscription();
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    window.location.assign(result.data.authorization_url); // Paystack's secure checkout page
  }

  return (
    <>
      <div className="plan-summary">
        <div>
          <strong>{me.store?.name}</strong>
          <small>
            {SITE.url.replace(/^https?:\/\//, "")}/{me.store?.slug}
          </small>
        </div>
        <div className="plan-summary-price">
          {formatNaira(SITE.monthlyPriceKobo)} <small>/ month</small>
        </div>
      </div>
      <ul className="plan-points">
        <li>
          <Check size={15} /> Your store goes live as soon as the payment is confirmed
        </li>
        <li>
          <Check size={15} /> Orders, customers, receipts and debt tracking
        </li>
        <li>
          <Check size={15} /> Pay securely with card, bank transfer or USSD through Paystack
        </li>
      </ul>
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary btn-full" type="button" onClick={pay} disabled={busy}>
        {busy ? "Opening Paystack…" : `Pay ${formatNaira(SITE.monthlyPriceKobo)} with Paystack`}{" "}
        <ArrowRight size={16} />
      </button>
      <p className="auth-fineprint">
        <ShieldCheck size={13} /> We never see or store your card details.
      </p>
    </>
  );
}

export default function Onboarding() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((result) => {
      if (cancelled) return;
      if (result.ok) setMe(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  if (me?.next_step === "done") return <Navigate to="/app" replace />;

  const step = me?.next_step === "subscribe" ? 2 : 1;
  return (
    <>
      <Seo seo={{ ...PAGE_META.onboarding, noindex: true }} />
      <AuthLayout
        wide
        title={step === 1 ? "Set up your store" : "Start your subscription"}
        subtitle={step === 1 ? "Choose how customers will find you." : "One simple plan. Cancel anytime."}
      >
        <Steps current={step} />
        {error && <Alert kind="error">{error}</Alert>}
        {!me && !error && (
          <p className="auth-loading" role="status">
            Loading…
          </p>
        )}
        {me?.next_step === "create_store" && (
          <StoreStep
            onCreated={() => {
              setMe(null);
              setReload((n) => n + 1);
            }}
          />
        )}
        {me?.next_step === "subscribe" && <SubscribeStep me={me} />}
      </AuthLayout>
    </>
  );
}
