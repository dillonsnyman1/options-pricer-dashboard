import { useEffect, useRef, useState } from "react";
import { fetchDividends, marketSmile } from "../api/client";
import type { DividendPayment, OptionInputs, OptionType } from "../types/options";

interface Props {
  inputs: OptionInputs;
  onChange: (inputs: OptionInputs) => void;
}

interface FieldDef {
  key: keyof Omit<OptionInputs, "option_type" | "discrete_dividends">;
  label: string;
  hint: string;
  step: number;
}

type MarketKey = "S" | "K" | "T" | "sigma" | "q";
type MarketSnapshot = Record<MarketKey, number>;

const MARKET_FIELDS: FieldDef[] = [
  { key: "S", label: "Spot (S)", hint: "Current asset price", step: 1 },
  { key: "K", label: "Strike (K)", hint: "Option strike price", step: 1 },
  { key: "T", label: "Expiry (T)", hint: "Years to expiry", step: 0.1 },
  { key: "sigma", label: "Vol (σ)", hint: "ATM implied vol", step: 0.01 },
  { key: "q", label: "Div Yield (q)", hint: "Continuous dividend yield", step: 0.01 },
];

const MARKET_KEYS: MarketKey[] = ["S", "K", "T", "sigma", "q"];

const MODEL_FIELDS: FieldDef[] = [
  { key: "r", label: "Rate (r)", hint: "Risk-free rate, e.g. 0.05", step: 0.01 },
  { key: "n_paths", label: "MC Paths", hint: "Simulation paths", step: 1000 },
  { key: "n_steps", label: "Binomial Steps", hint: "Tree steps", step: 50 },
];

export function OptionForm({ inputs, onChange }: Props) {
  const [draft, setDraft] = useState<OptionInputs>(inputs);
  const [ticker, setTicker] = useState("");
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);
  const [marketSource, setMarketSource] = useState<MarketSnapshot | null>(null);
  const [sourceDivs, setSourceDivs] = useState<DividendPayment[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fetchedTicker = useRef("");
  const divDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const CACHE_TTL = 60;

  useEffect(() => {
    if (fetchedAt === null) return;
    setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchedAt]);

  function isEdited(key: MarketKey): boolean {
    if (!marketSource) return false;
    return draft[key] !== marketSource[key];
  }

  const anyEdited = marketSource !== null && MARKET_KEYS.some((k) => isEdited(k));

  function resetField(key: MarketKey) {
    if (!marketSource) return;
    const next = { ...draft, [key]: marketSource[key] };
    setDraft(next);
    const el = document.getElementById(key) as HTMLInputElement | null;
    if (el) el.value = String(marketSource[key]);
    if (key === "T" && fetchedTicker.current) {
      fetchDividends(fetchedTicker.current, marketSource[key])
        .then((divs) => {
          setDraft((d) => ({ ...d, discrete_dividends: divs }));
          setSourceDivs(divs);
        })
        .catch(() => {});
    }
  }

  function resetAllToSource() {
    if (!marketSource) return;
    const next = {
      ...draft,
      ...marketSource,
      ...(sourceDivs ? { discrete_dividends: sourceDivs } : {}),
    };
    setDraft(next);
    onChange(next);
    for (const key of MARKET_KEYS) {
      const el = document.getElementById(key) as HTMLInputElement | null;
      if (el) el.value = String(marketSource[key]);
    }
  }

  function handleNumericChange(field: keyof Omit<OptionInputs, "option_type">, raw: string) {
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      setDraft((prev) => {
        const next = { ...prev, [field]: val };
        if (field === "T" && fetchedTicker.current) {
          clearTimeout(divDebounce.current);
          divDebounce.current = setTimeout(() => {
            fetchDividends(fetchedTicker.current, val)
              .then((divs) => {
                setDraft((d) => ({ ...d, discrete_dividends: divs }));
              })
              .catch(() => {});
          }, 400);
        }
        return next;
      });
    }
  }

  function handleFetchTicker() {
    if (!ticker.trim()) return;
    const sym = ticker.trim().toUpperCase();
    setTickerLoading(true);
    setTickerError(null);
    marketSmile(sym, null, draft.r, draft.q)
      .then(async (res) => {
        const atmPoint = res.points.length > 0
          ? res.points.reduce((a, b) => Math.abs(a.moneyness) < Math.abs(b.moneyness) ? a : b)
          : null;
        const newT = parseFloat(res.expiry_T.toFixed(4));
        const newSigma = atmPoint ? parseFloat(atmPoint.implied_vol.toFixed(4)) : draft.sigma;
        const newQ = parseFloat(res.dividend_yield.toFixed(4));
        const newK = Math.round(res.spot);
        const divs = await fetchDividends(sym, newT);

        const snapshot: MarketSnapshot = {
          S: res.spot,
          K: newK,
          T: newT,
          sigma: newSigma,
          q: newQ,
        };
        setMarketSource(snapshot);
        setSourceDivs(divs);
        setFetchedAt(Date.now());

        const next = {
          ...draft,
          ...snapshot,
          discrete_dividends: divs,
        };
        fetchedTicker.current = sym;
        setDraft(next);
        onChange(next);
        for (const key of MARKET_KEYS) {
          const el = document.getElementById(key) as HTMLInputElement | null;
          if (el) el.value = String(snapshot[key]);
        }
      })
      .catch((err: unknown) => setTickerError(err instanceof Error ? err.message : "Lookup failed"))
      .finally(() => setTickerLoading(false));
  }

  function handleTypeChange(t: OptionType) {
    const next = { ...draft, option_type: t };
    setDraft(next);
    onChange(next);
  }

  function handleApply() {
    if (fetchedTicker.current) {
      fetchDividends(fetchedTicker.current, draft.T)
        .then((divs) => {
          const next = { ...draft, discrete_dividends: divs };
          setDraft(next);
          onChange(next);
        })
        .catch(() => onChange(draft));
    } else {
      onChange(draft);
    }
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

  function renderMarketFields() {
    return MARKET_FIELDS.map(({ key, label, hint, step }) => {
      const edited = isEdited(key as MarketKey);
      return (
        <div className={`form-field${edited ? " field-edited" : ""}`} key={key}>
          <label htmlFor={key}>
            {label}
            {edited && (
              <button
                className="field-reset-btn"
                title={`Reset to ${marketSource![key as MarketKey]}`}
                onClick={() => resetField(key as MarketKey)}
              >
                ↺
              </button>
            )}
          </label>
          <input
            id={key}
            type="number"
            step={step}
            defaultValue={draft[key]}
            onChange={(e) => handleNumericChange(key, e.target.value)}
          />
          <span className="form-field-hint">
            {edited
              ? <span className="field-source-hint">Source: {marketSource![key as MarketKey]}</span>
              : hint}
          </span>
        </div>
      );
    });
  }

  function renderModelFields() {
    return MODEL_FIELDS.map(({ key, label, hint, step }) => (
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
    ));
  }

  return (
    <div className="option-form-container">
      <div className="form-section">
        <span className="form-section-header">
          Market Data
          {fetchedAt !== null && (
            <span className={`data-freshness${elapsed >= CACHE_TTL ? " stale" : ""}`}>
              {elapsed < CACHE_TTL
                ? `Live ${elapsed}s ago`
                : `Stale (${Math.floor(elapsed / 60)}m ${elapsed % 60}s ago)`}
              {elapsed >= CACHE_TTL && (
                <button className="refresh-btn" onClick={handleFetchTicker}>↻</button>
              )}
            </span>
          )}
          {anyEdited && (
            <button className="reset-all-btn" onClick={resetAllToSource}>
              ↺ Reset all to source
            </button>
          )}
        </span>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="ticker">Ticker</label>
            <input
              id="ticker"
              type="text"
              placeholder="AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleFetchTicker()}
              disabled={tickerLoading}
            />
            <span className="form-field-hint">
              {tickerLoading
                ? "Fetching..."
                : tickerError
                  ? <span style={{ color: "#dc2626" }}>{tickerError}</span>
                  : "Enter ticker, press Enter"}
            </span>
          </div>
          {renderMarketFields()}
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
              <button className="remove-dividend-btn" onClick={() => removeDividend(i)}>x</button>
            </div>
          ))}
          <button className="add-dividend-btn" onClick={addDividend}>+ Add Dividend</button>
        </div>
      </div>

      <div className="form-section">
        <span className="form-section-header">Model Settings</span>
        <div className="form-row">
          {renderModelFields()}
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
        </div>
      </div>

      <button className="apply-button" onClick={handleApply}>
        Recalculate
      </button>
    </div>
  );
}
