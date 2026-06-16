import { useState } from "react";
import type { OptionInputs, OptionType } from "../types/options";

interface Props {
  inputs: OptionInputs;
  onChange: (inputs: OptionInputs) => void;
}

const FIELDS: { key: keyof Omit<OptionInputs, "option_type">; label: string; hint: string; step: number }[] = [
  { key: "S", label: "Spot (S)", hint: "Current asset price", step: 1 },
  { key: "K", label: "Strike (K)", hint: "Option strike price", step: 1 },
  { key: "T", label: "Expiry (T)", hint: "Years to expiry", step: 0.1 },
  { key: "r", label: "Rate (r)", hint: "Risk-free rate, e.g. 0.05", step: 0.01 },
  { key: "sigma", label: "Vol (σ)", hint: "Annualised vol, e.g. 0.20", step: 0.01 },
];

export function OptionForm({ inputs, onChange }: Props) {
  const [draft, setDraft] = useState<OptionInputs>(inputs);

  function handleNumericChange(field: keyof Omit<OptionInputs, "option_type">, raw: string) {
    const val = parseFloat(raw);
    if (!isNaN(val)) setDraft((prev) => ({ ...prev, [field]: val }));
  }

  function handleTypeChange(t: OptionType) {
    const next = { ...draft, option_type: t };
    setDraft(next);
    onChange(next);
  }

  function handleApply() {
    onChange(draft);
  }

  return (
    <div className="option-form">
      {FIELDS.map(({ key, label, hint, step }) => (
        <div className="form-field" key={key}>
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            type="number"
            step={step}
            defaultValue={draft[key]}
            onChange={(e) => handleNumericChange(key, e.target.value)}
          />
          <span className="form-field-hint">{hint}</span>
        </div>
      ))}

      <div className="form-field">
        <label>Type</label>
        <div className="type-toggle">
          {(["call", "put"] as OptionType[]).map((t) => (
            <label key={t} className={`type-option${draft.option_type === t ? " active" : ""}`}>
              <input
                type="radio"
                name="option_type"
                value={t}
                checked={draft.option_type === t}
                onChange={() => handleTypeChange(t)}
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <button className="apply-button" onClick={handleApply}>
        Recalculate
      </button>
    </div>
  );
}
