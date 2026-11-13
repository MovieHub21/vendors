import { useState } from "react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: displayNames.of(code) ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

function toE164(local: string, country: CountryCode) {
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  // Parsing removes the selected country's national trunk prefix (for example 0 in Nigeria).
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.number ?? `+${getCountryCallingCode(country)}${digits.replace(/^0+/, "")}`;
}

export const isCompletePhoneNumber = (value: string) => isValidPhoneNumber(value);

export function PhoneNumberField({
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  autoComplete = "tel",
}: {
  label: string;
  value: string;
  onChange: (internationalNumber: string) => void;
  error?: string | null;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const initial = value ? parsePhoneNumberFromString(value, value.startsWith("+") ? undefined : "NG") : undefined;
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? "NG");
  const [local, setLocal] = useState(initial?.nationalNumber ?? "");
  const id = `phone-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      <label htmlFor={`${id}-local`}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      <div className="phone-number-control" aria-describedby={messageId}>
        <select
          aria-label="Country calling code"
          value={country}
          onChange={(event) => {
            const next = event.target.value as CountryCode;
            setCountry(next);
            onChange(toE164(local, next));
          }}
        >
          {COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.dialCode})</option>)}
        </select>
        <input
          id={`${id}-local`}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          value={local}
          placeholder="8012345678"
          aria-invalid={Boolean(error)}
          aria-describedby={messageId}
          onChange={(event) => {
            const next = event.target.value;
            setLocal(next);
            onChange(toE164(next, country));
          }}
        />
      </div>
      {error ? <small id={`${id}-error`} className="field-error">{error}</small> : hint ? <small id={`${id}-hint`} className="field-hint">{hint}</small> : null}
    </div>
  );
}
