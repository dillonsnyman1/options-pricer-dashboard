import { useState } from "react";
import type { DividendPayment, OptionInputs, OptionType } from "../types/options";

interface Props {
  inputs: OptionInputs;
  onChange: (inputs: OptionInputs) => void;
}

const FIELDS: { key: keyof Omit<OptionInputs, "option_type" | "discrete_dividends">; label: string; hint: string; step: number }[] = [
  { key: "S", label: "Spot (S)", hint: "Current asset price", step: 1 },
  { key: "K", label: "Strike (K)", hint: "Option strike price", step: 1 },
  { key: "T", label: "Expiry (T)", hint: "Years to expiry", step: 0.1 },
  { key: "r", label: "Rate (r)", hint: "Risk-free rate, e.g. 0.05", step: 0.01 },
  { key: "sigma", label: "Vol (σ)", hint: "Annualised vol, e.g. 0.20", step: 0.01 },
  { key: "q", label: "Div Yield (q)", hint: "Continuous dividend yield, e.g. 0.02", step: 0.01 },
  { key: "n_paths", label: "MC Paths", hint: "Simulation paths, e.g. 200000", step: 1000 },
  { key: "n_steps", label: "Binomial Steps", hint: "Tree steps, e.g. 500", step: 50 },
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

  function addDividend() {
    setDraft((prev) => ({
      ...prev,
      discrete_dividends: [...prev.discrete_dividends, { t: 0.5, D: 1.0 }],
    }));
  }

  function removeDividend(i: number) {
    setDraft((prev) => ({
      ...prev,
      discrete_dividends: prev.discrete_dividends.filter((_, idx) => idx !== i),
    }));
  }

  function updateDividend(i: number, field: keyof DividendPayment, value: number) {
    if (!isNaN(value)) {
      setDraft((prev) => ({
        ...prev,
        discrete_dividends: prev.discrete_dividends.map((d, idx) =>
          idx === i ? { ...d, [field]: value } : d
        ),
      }));
    }
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

      <div className="dividends-section">
        <span className="dividends-header">Discrete Dividends</span>
        {draft.discrete_dividends.map((div, i) => (
          <div key={i} className="dividend-row">
            <span className="dividend-label">t =</span>
            <input
              className="dividend-input"
              type="number"
              step={0.25}
              min={0.01}
              value={div.t}
              onChange={(e) => updateDividend(i, "t", parseFloat(e.target.value))}
            />
            <span className="dividend-label">yr &nbsp; D =</span>
            <input
              className="dividend-input"
              type="number"
              step={0.5}
              min={0.01}
              value={div.D}
              onChange={(e) => updateDividend(i, "D", parseFloat(e.target.value))}
            />
            <button className="remove-dividend-btn" onClick={() => removeDividend(i)}>×</button>
          </div>
        ))}
        <button className="add-dividend-btn" onClick={addDividend}>+ Add Dividend</button>
      </div>

      <button className="apply-button" onClick={handleApply}>
        Recalculate
      </button>
    </div>
  );
}
