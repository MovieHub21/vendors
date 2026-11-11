import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  prefix?: string;
}

export function Field({ label, error, hint, prefix, className, ...input }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? " field-invalid" : ""}${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className={prefix ? "field-prefixed" : undefined}>
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      </div>
      {error ? (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      ) : hint ? (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  error,
  children,
  ...select
}: { label: string; error?: string | null; children: ReactNode } & Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "id"
>) {
  const id = useId();
  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} {...select}>
        {children}
      </select>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
