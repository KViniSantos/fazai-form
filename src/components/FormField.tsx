import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export default function FormField({ label, htmlFor, required, error, hint, children }: FormFieldProps) {
  const errorId = `${htmlFor}-error`;

  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>
        {label} {required ? <span aria-hidden="true">*</span> : <small>(opcional)</small>}
      </label>
      {children}
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
