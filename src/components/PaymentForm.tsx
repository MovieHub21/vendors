import { useState, type FormEvent } from "react";
import { Alert } from "./AuthLayout";
import { formatNaira } from "../lib/money";
import { PAYMENT_METHODS, koboToInput, nairaToKobo, type PaymentMethod } from "../lib/sales";
import { recordOrderPayment, type PaymentResult } from "../services/sales";

/** Records an additional (manual) payment against an order. The server checks the amount against what is still owed. */
export function PaymentForm({
  orderId,
  outstandingKobo,
  onRecorded,
}: {
  orderId: string;
  outstandingKobo: number;
  onRecorded: (result: PaymentResult) => void;
}) {
  const [amount, setAmount] = useState(koboToInput(outstandingKobo));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kobo = nairaToKobo(amount);
    if (!kobo || kobo < 1) return setError("Enter the amount received, for example 25,000.");
    if (kobo > outstandingKobo) return setError(`That is more than the ${formatNaira(outstandingKobo)} still owed.`);
    setBusy(true);
    setError(null);
    const r = await recordOrderPayment(orderId, kobo, method, note.trim() || undefined);
    setBusy(false);
    if (r.ok) onRecorded(r.data.payment);
    else setError(r.message);
  }

  return (
    <form className="pay-form" onSubmit={submit}>
      <h3>Record a payment</h3>
      <p className="muted">Still owed: {formatNaira(outstandingKobo)}</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`amt-${orderId}`}>Amount received (₦)</label>
          <input id={`amt-${orderId}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`mth-${orderId}`}>Paid by</label>
          <select id={`mth-${orderId}`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`note-${orderId}`}>Note (optional)</label>
        <input id={`note-${orderId}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save payment"}
      </button>
    </form>
  );
}
