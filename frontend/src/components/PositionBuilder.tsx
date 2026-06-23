import React, { useEffect, useRef, useState } from "react";
import { fetchDividends, marketSmile } from "../api/client";
import type { OptionType, PortfolioPosition } from "../types/options";

interface Props {
  positions: PortfolioPosition[];
  onChange: (positions: PortfolioPosition[]) => void;
}

type MarketField = "S" | "K" | "T" | "sigma" | "q";
const MARKET_FIELDS: MarketField[] = ["S", "K", "T", "sigma", "q"];

function newPosition(defaults?: Partial<PortfolioPosition>): PortfolioPosition {
  return {
    id: crypto.randomUUID(),
    ticker: "",
    option_type: "call",
    S: 0,
    K: 0,
    T: 0,
    r: 0.05,
    sigma: 0,
    q: 0,
    quantity: 1,
    n_paths: 200_000,
    n_steps: 500,
    discrete_dividends: [],
    ...defaults,
  };
}

export function PositionBuilder({ positions, onChange }: Props) {
  const [fetching, setFetching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sourceSnapshots, setSourceSnapshots] = useState<Map<string, Record<MarketField, number>>>(new Map());
  const [expandedDivs, setExpandedDivs] = useState<Set<string>>(new Set());
  const hasFetched = useRef(false);
  const divDebounces = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const CACHE_TTL = 60;

  useEffect(() => {
    if (fetchedAt === null) return;
    setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchedAt]);

  function addPosition() {
    onChange([...positions, newPosition()]);
  }

  function removePosition(id: string) {
    onChange(positions.filter((p) => p.id !== id));
    setSourceSnapshots((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  function updatePosition(id: string, field: string, value: unknown) {
    const updated = positions.map((p) => p.id === id ? { ...p, [field]: value } : p);
    onChange(updated);

    if (field === "T" && typeof value === "number" && value > 0) {
      const pos = updated.find((p) => p.id === id);
      if (pos && pos.ticker.trim()) {
        const existing = divDebounces.current.get(id);
        if (existing) clearTimeout(existing);
        divDebounces.current.set(id, setTimeout(() => {
          fetchDividends(pos.ticker, value)
            .then((divs) => {
              onChange(positionsRef.current.map((p) => p.id === id ? { ...p, discrete_dividends: divs } : p));
            })
            .catch(() => {});
        }, 400));
      }
    }
  }

  function resetField(id: string, field: MarketField) {
    const snap = sourceSnapshots.get(id);
    if (!snap) return;
    onChange(positions.map((p) => p.id === id ? { ...p, [field]: snap[field] } : p));
  }

  function resetAllForPosition(id: string) {
    const snap = sourceSnapshots.get(id);
    if (!snap) return;
    onChange(positions.map((p) => p.id === id ? { ...p, ...snap } : p));
  }

  function isEdited(pos: PortfolioPosition, field: MarketField): boolean {
    const snap = sourceSnapshots.get(pos.id);
    if (!snap) return false;
    return pos[field] !== snap[field];
  }

  function hasAnyEdited(pos: PortfolioPosition): boolean {
    return MARKET_FIELDS.some((f) => isEdited(pos, f));
  }

  async function fetchAll() {
    const tickerPositions = positions.filter((p) => p.ticker.trim());
    if (tickerPositions.length === 0) return;

    setFetching(true);
    setFetchError(null);

    const updates = new Map<string, Partial<PortfolioPosition>>();
    const newSnapshots = new Map(sourceSnapshots);
    const errors: string[] = [];

    await Promise.all(
      tickerPositions.map(async (pos) => {
        try {
          const res = await marketSmile(pos.ticker);
          const atmPoint = res.points.length > 0
            ? res.points.reduce((a, b) => Math.abs(a.moneyness) < Math.abs(b.moneyness) ? a : b)
            : null;
          const newT = parseFloat(res.expiry_T.toFixed(4));
          const divs = await fetchDividends(pos.ticker, newT).catch(() => []);
          const fetched = {
            S: res.spot,
            K: Math.round(res.spot),
            T: newT,
            q: parseFloat(res.dividend_yield.toFixed(4)),
            sigma: atmPoint ? parseFloat(atmPoint.implied_vol.toFixed(4)) : pos.sigma,
          };
          updates.set(pos.id, { ticker: pos.ticker.toUpperCase(), ...fetched, discrete_dividends: divs });
          newSnapshots.set(pos.id, fetched);
        } catch {
          errors.push(pos.ticker);
        }
      })
    );

    setSourceSnapshots(newSnapshots);
    onChange(positions.map((p) => {
      const upd = updates.get(p.id);
      return upd ? { ...p, ...upd } : p;
    }));

    hasFetched.current = true;
    setFetchedAt(Date.now());
    setFetching(false);
    if (errors.length > 0) {
      setFetchError(`Failed to fetch: ${errors.join(", ")}`);
    }
  }

  const tickerCount = positions.filter((p) => p.ticker.trim()).length;
  const isFetched = hasFetched.current && fetchedAt !== null;

  function renderMarketCell(pos: PortfolioPosition, field: MarketField, step: number) {
    const edited = isEdited(pos, field);
    const snap = sourceSnapshots.get(pos.id);
    return (
      <td className={edited ? "cell-edited" : ""}>
        <div className="cell-with-reset">
          <input
            type="number"
            step={step}
            value={pos[field]}
            onChange={(e) => updatePosition(pos.id, field, parseFloat(e.target.value) || 0)}
          />
          {edited && (
            <button
              className="field-reset-btn"
              title={`Reset to ${snap![field]}`}
              onClick={() => resetField(pos.id, field)}
            >
              ↺
            </button>
          )}
        </div>
        {edited && <div className="cell-source-hint">Source: {snap![field]}</div>}
      </td>
    );
  }

  return (
    <div className="position-builder">
      <p className="chart-subtitle" style={{ marginTop: 0 }}>
        Add positions, enter tickers and quantities, then press Fetch All to populate market data.
      </p>

      <div className="position-table-scroll">
        <table className="position-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Rate (r)</th>
              <th>MC Paths</th>
              <th>Bin Steps</th>
              {isFetched && (
                <>
                  <th>Spot (S)</th>
                  <th>Strike (K)</th>
                  <th>Expiry (T)</th>
                  <th>Vol (σ)</th>
                  <th>Div Yield (q)</th>
                  <th>Dividends</th>
                  <th></th>
                </>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <React.Fragment key={pos.id}>
              <tr>
                <td>
                  <input
                    type="text"
                    value={pos.ticker}
                    placeholder="AAPL"
                    onChange={(e) => updatePosition(pos.id, "ticker", e.target.value.toUpperCase())}
                  />
                </td>
                <td>
                  <div className="type-toggle">
                    {(["call", "put"] as OptionType[]).map((t) => (
                      <label key={t} className={`type-option${pos.option_type === t ? " active" : ""}`}>
                        <input
                          type="radio"
                          name={`type-${pos.id}`}
                          value={t}
                          checked={pos.option_type === t}
                          onChange={() => updatePosition(pos.id, "option_type", t)}
                        />
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </label>
                    ))}
                  </div>
                </td>
                <td><input type="number" step={1} value={pos.quantity} onChange={(e) => updatePosition(pos.id, "quantity", parseInt(e.target.value) || 0)} /></td>
                <td><input type="number" step={0.01} value={pos.r} onChange={(e) => updatePosition(pos.id, "r", parseFloat(e.target.value) || 0)} /></td>
                <td><input className="input-wide" type="number" step={1000} value={pos.n_paths} onChange={(e) => updatePosition(pos.id, "n_paths", parseInt(e.target.value) || 0)} /></td>
                <td><input type="number" step={50} value={pos.n_steps} onChange={(e) => updatePosition(pos.id, "n_steps", parseInt(e.target.value) || 0)} /></td>
                {isFetched && (
                  <>
                    {renderMarketCell(pos, "S", 1)}
                    {renderMarketCell(pos, "K", 1)}
                    {renderMarketCell(pos, "T", 0.1)}
                    {renderMarketCell(pos, "sigma", 0.01)}
                    {renderMarketCell(pos, "q", 0.01)}
                    <td>
                      <button
                        className="toggle-btn"
                        style={{ padding: "4px 10px", fontSize: 12, whiteSpace: "nowrap" }}
                        onClick={() => setExpandedDivs((prev) => {
                          const next = new Set(prev);
                          next.has(pos.id) ? next.delete(pos.id) : next.add(pos.id);
                          return next;
                        })}
                      >
                        {pos.discrete_dividends.length > 0
                          ? `${pos.discrete_dividends.length} div${pos.discrete_dividends.length > 1 ? "s" : ""}`
                          : "None"} {expandedDivs.has(pos.id) ? "▴" : "▾"}
                      </button>
                    </td>
                    <td>
                      {hasAnyEdited(pos) && (
                        <button
                          className="field-reset-btn"
                          title="Reset all to source"
                          onClick={() => resetAllForPosition(pos.id)}
                        >
                          ↺ all
                        </button>
                      )}
                    </td>
                  </>
                )}
                <td>
                  <button className="remove-dividend-btn" onClick={() => removePosition(pos.id)}>x</button>
                </td>
              </tr>
              {isFetched && expandedDivs.has(pos.id) && (
                <tr className="dividend-expand-row">
                  <td colSpan={14}>
                    <div className="dividend-expand-content">
                      <span className="control-label">Discrete Dividends for {pos.ticker || "position"}</span>
                      {pos.discrete_dividends.map((div, i) => (
                        <div key={i} className="dividend-row">
                          <span className="dividend-label">t =</span>
                          <input
                            className="dividend-input"
                            type="number"
                            step={0.25}
                            min={0.01}
                            value={div.t}
                            onChange={(e) => {
                              const newDivs = pos.discrete_dividends.map((d, idx) =>
                                idx === i ? { ...d, t: parseFloat(e.target.value) || 0 } : d
                              );
                              updatePosition(pos.id, "discrete_dividends", newDivs);
                            }}
                          />
                          <span className="dividend-label">yr &nbsp; D =</span>
                          <input
                            className="dividend-input"
                            type="number"
                            step={0.5}
                            min={0.01}
                            value={div.D}
                            onChange={(e) => {
                              const newDivs = pos.discrete_dividends.map((d, idx) =>
                                idx === i ? { ...d, D: parseFloat(e.target.value) || 0 } : d
                              );
                              updatePosition(pos.id, "discrete_dividends", newDivs);
                            }}
                          />
                          <button className="remove-dividend-btn" onClick={() => {
                            const newDivs = pos.discrete_dividends.filter((_, idx) => idx !== i);
                            updatePosition(pos.id, "discrete_dividends", newDivs);
                          }}>x</button>
                        </div>
                      ))}
                      {pos.discrete_dividends.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--text)" }}>No dividends within expiry window.</span>
                      )}
                      <button className="add-dividend-btn" style={{ marginTop: 4 }} onClick={() => {
                        updatePosition(pos.id, "discrete_dividends", [...pos.discrete_dividends, { t: 0.5, D: 1.0 }]);
                      }}>+ Add Dividend</button>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={isFetched ? 13 : 7} style={{ textAlign: "center", color: "var(--text)", padding: 16 }}>
                  No positions. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="portfolio-toolbar">
        <button className="add-dividend-btn" onClick={addPosition}>+ Add Position</button>
        {tickerCount > 0 && (
          <button className="add-dividend-btn fetch-all-btn" onClick={fetchAll} disabled={fetching}>
            {fetching ? "Fetching..." : "Fetch All"}
          </button>
        )}
        {positions.length > 0 && (
          <button className="add-dividend-btn" onClick={() => { onChange([]); hasFetched.current = false; setFetchedAt(null); setSourceSnapshots(new Map()); }}>
            Clear All
          </button>
        )}
        {isFetched && (
          <span className={`data-freshness${elapsed >= CACHE_TTL ? " stale" : ""}`}>
            {elapsed < CACHE_TTL
              ? `Live ${elapsed}s ago`
              : `Stale (${Math.floor(elapsed / 60)}m ${elapsed % 60}s ago)`}
            {elapsed >= CACHE_TTL && (
              <button className="refresh-btn" onClick={fetchAll}>↻</button>
            )}
          </span>
        )}
        {fetchError && <span style={{ color: "#dc2626", fontSize: 12 }}>{fetchError}</span>}
      </div>
    </div>
  );
}
