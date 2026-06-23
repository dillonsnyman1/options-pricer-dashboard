import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ivSmile, marketSmile } from "../api/client";
import type { IVSmilePoint, MarketSmilePoint, MarketSmileResponse, OptionInputs } from "../types/options";

type SmileMode = "synthetic" | "market" | "both";

interface Props {
  inputs: OptionInputs;
}

interface MergedPoint {
  moneyness: number;
  synthetic_iv?: number;
  market_iv?: number;
  strike?: number;
  mid_price?: number;
  bid?: number;
  ask?: number;
  open_interest?: number;
  option_type?: string;
}

const SUBTITLES: Record<SmileMode, string> = {
  synthetic:
    "Parametric smile: σ(K) = σ_ATM + skew·ln(K/S) + curvature·ln(K/S)². IVs are backed out from the generated prices via Newton-Raphson.",
  market:
    "Implied volatilities backed out from live option mid prices via Newton-Raphson. Uses OTM puts below spot, OTM calls above.",
  both:
    "Blue line: parametric model. Red dots: market-observed IVs. X-axis shows log-moneyness ln(K/S) so both curves are comparable.",
};

export function IVSmileChart({ inputs }: Props) {
  const [mode, setMode] = useState<SmileMode>("synthetic");

  // Synthetic state
  const [skew, setSkew] = useState(-0.2);
  const [curvature, setCurvature] = useState(0.5);
  const [strikeRange, setStrikeRange] = useState(0.25);
  const [syntheticData, setSyntheticData] = useState<IVSmilePoint[]>([]);
  const [syntheticLoading, setSyntheticLoading] = useState(false);
  const [syntheticError, setSyntheticError] = useState<string | null>(null);
  const skewRef = useRef(skew);
  const curvatureRef = useRef(curvature);
  const strikeRangeRef = useRef(strikeRange);

  // Market state
  const [ticker, setTicker] = useState("AAPL");
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [marketMeta, setMarketMeta] = useState<Omit<MarketSmileResponse, "points"> & { atm_iv: number | null } | null>(null);
  const [marketData, setMarketData] = useState<MarketSmilePoint[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  function loadSynthetic(s: number, c: number, sr?: number) {
    setSyntheticLoading(true);
    setSyntheticError(null);
    ivSmile(inputs, s, c, 20, sr ?? strikeRangeRef.current)
      .then(setSyntheticData)
      .catch((err: unknown) => setSyntheticError(err instanceof Error ? err.message : "Failed to load IV smile."))
      .finally(() => setSyntheticLoading(false));
  }

  function loadMarket(t: string, expiry: string | null) {
    setMarketLoading(true);
    setMarketError(null);
    marketSmile(t, expiry, inputs.r, inputs.q)
      .then((res) => {
        setMarketData(res.points);
        const atmPoint = res.points.length > 0
          ? res.points.reduce((a, b) => Math.abs(a.moneyness) < Math.abs(b.moneyness) ? a : b)
          : null;
        setMarketMeta({ ticker: res.ticker, spot: res.spot, dividend_yield: res.dividend_yield, expiry: res.expiry, expiry_T: res.expiry_T, available_expiries: res.available_expiries, discrete_dividends: res.discrete_dividends, atm_iv: atmPoint?.implied_vol ?? null });
        if (selectedExpiry === null) {
          setSelectedExpiry(res.expiry);
        }
      })
      .catch((err: unknown) => setMarketError(err instanceof Error ? err.message : "Failed to fetch market data."))
      .finally(() => setMarketLoading(false));
  }

  useEffect(() => {
    if (mode === "synthetic" || mode === "both") {
      loadSynthetic(skewRef.current, curvatureRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  function handleSkewCommit() {
    skewRef.current = skew;
    loadSynthetic(skew, curvatureRef.current);
  }

  function handleCurvatureCommit() {
    curvatureRef.current = curvature;
    loadSynthetic(skewRef.current, curvature);
  }

  function handleStrikeRangeCommit() {
    strikeRangeRef.current = strikeRange;
    loadSynthetic(skewRef.current, curvatureRef.current, strikeRange);
  }

  function handleFetchMarket() {
    setTicker(tickerInput);
    loadMarket(tickerInput, selectedExpiry);
  }

  function handleExpiryChange(expiry: string) {
    setSelectedExpiry(expiry);
    loadMarket(ticker, expiry);
  }

  function handleModeChange(newMode: SmileMode) {
    setMode(newMode);
    if ((newMode === "synthetic" || newMode === "both") && syntheticData.length === 0) {
      loadSynthetic(skewRef.current, curvatureRef.current);
    }
    if ((newMode === "market" || newMode === "both") && marketData.length === 0) {
      loadMarket(ticker, selectedExpiry);
    }
  }

  const loading = (mode !== "market" && syntheticLoading) || (mode !== "synthetic" && marketLoading);
  const error = mode === "synthetic" ? syntheticError : mode === "market" ? marketError : syntheticError || marketError;

  const showSynthetic = mode === "synthetic" || mode === "both";
  const showMarket = mode === "market" || mode === "both";

  return (
    <div className="chart-card wide">
      <h3>Implied Volatility Smile</h3>
      <p className="chart-subtitle">{SUBTITLES[mode]}</p>

      {/* Mode toggle */}
      <div className="chart-controls">
        <div className="control-group">
          <span className="control-label">Source</span>
          <div className="toggle-group">
            {(["synthetic", "market", "both"] as SmileMode[]).map((m) => (
              <button
                key={m}
                className={`toggle-btn${mode === m ? " active" : ""}`}
                onClick={() => handleModeChange(m)}
              >
                {m === "synthetic" ? "Synthetic" : m === "market" ? "Market" : "Both"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Synthetic controls */}
      {showSynthetic && (
        <div className="chart-controls">
          <div className="control-group">
            <span className="control-label">Skew: {skew.toFixed(2)}</span>
            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.05"
              value={skew}
              onChange={(e) => setSkew(Number(e.target.value))}
              onMouseUp={handleSkewCommit}
              onTouchEnd={handleSkewCommit}
            />
          </div>
          <div className="control-group">
            <span className="control-label">Curvature: {curvature.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={curvature}
              onChange={(e) => setCurvature(Number(e.target.value))}
              onMouseUp={handleCurvatureCommit}
              onTouchEnd={handleCurvatureCommit}
            />
          </div>
          <div className="control-group">
            <span className="control-label">Strike range: ±{(strikeRange * 100).toFixed(0)}%</span>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={strikeRange}
              onChange={(e) => setStrikeRange(Number(e.target.value))}
              onMouseUp={handleStrikeRangeCommit}
              onTouchEnd={handleStrikeRangeCommit}
            />
          </div>
        </div>
      )}

      {/* Market controls */}
      {showMarket && (
        <div className="chart-controls">
          <div className="control-group">
            <span className="control-label">Ticker</span>
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleFetchMarket()}
              style={{ width: 80, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>
          {marketMeta && marketMeta.available_expiries.length > 0 && (
            <div className="control-group">
              <span className="control-label">Expiry</span>
              <select
                value={selectedExpiry ?? ""}
                onChange={(e) => handleExpiryChange(e.target.value)}
                style={{ padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)" }}
              >
                {marketMeta.available_expiries.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          <div className="control-group">
            <span className="control-label">&nbsp;</span>
            <button className="toggle-btn active" onClick={handleFetchMarket} disabled={marketLoading}>
              {marketLoading ? "Loading..." : "Fetch"}
            </button>
          </div>
          {marketMeta && (
            <div className="control-group">
              <span className="control-label">Spot: ${marketMeta.spot.toFixed(2)}</span>
              <span style={{ fontSize: 12, color: "var(--text)" }}>
                {marketData.length} strikes &middot; T = {marketMeta.expiry_T.toFixed(3)}y
                {marketMeta.atm_iv != null && <> &middot; ATM IV = {(marketMeta.atm_iv * 100).toFixed(1)}%</>}
              </span>
            </div>
          )}
        </div>
      )}

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">{error}</div>}

      {!loading && <ChartView
        mode={mode}
        syntheticData={syntheticData}
        marketData={marketData}
        syntheticSpot={inputs.S}
        marketSpot={marketMeta?.spot ?? null}
      />}
    </div>
  );
}

function ChartView({
  mode,
  syntheticData,
  marketData,
  syntheticSpot,
  marketSpot,
}: {
  mode: SmileMode;
  syntheticData: IVSmilePoint[];
  marketData: MarketSmilePoint[];
  syntheticSpot: number;
  marketSpot: number | null;
}) {
  if (mode === "synthetic") {
    if (syntheticData.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={syntheticData} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="strike"
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 12 }}
            label={{ value: "Strike", position: "insideBottom", offset: -10, fontSize: 12, fill: "#475569" }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 12 }}
            label={{ value: "Implied Vol", angle: -90, position: "insideLeft", fontSize: 12, fill: "#475569" }}
          />
          <Tooltip
            formatter={(v: unknown) => [`${((v as number) * 100).toFixed(2)}%`, "Implied Vol"]}
            labelFormatter={(v: unknown) => `Strike: $${Number(v).toFixed(2)}`}
          />
          <ReferenceLine
            x={syntheticSpot}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: "ATM", position: "top", fontSize: 11, fill: "#64748b" }}
          />
          <Line type="monotone" dataKey="implied_vol" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (mode === "market") {
    if (marketData.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={marketData} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="strike"
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 12 }}
            label={{ value: "Strike", position: "insideBottom", offset: -10, fontSize: 12, fill: "#475569" }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 12 }}
            label={{ value: "Implied Vol", angle: -90, position: "insideLeft", fontSize: 12, fill: "#475569" }}
          />
          <Tooltip
            content={<MarketTooltip />}
          />
          {marketSpot && (
            <ReferenceLine
              x={marketSpot}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: "ATM", position: "top", fontSize: 11, fill: "#64748b" }}
            />
          )}
          <Line type="monotone" dataKey="implied_vol" stroke="#dc2626" strokeWidth={2} dot={{ r: 4, fill: "#dc2626" }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Both mode: overlay on moneyness axis
  const merged = mergeData(syntheticData, marketData);
  if (merged.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={merged} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="moneyness"
          tickFormatter={(v: number) => v.toFixed(2)}
          tick={{ fontSize: 12 }}
          label={{ value: "Moneyness ln(K/S)", position: "insideBottom", offset: -10, fontSize: 12, fill: "#475569" }}
        />
        <YAxis
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          tick={{ fontSize: 12 }}
          label={{ value: "Implied Vol", angle: -90, position: "insideLeft", fontSize: 12, fill: "#475569" }}
        />
        <Tooltip
          content={<BothTooltip />}
        />
        <ReferenceLine
          x={0}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: "ATM", position: "top", fontSize: 11, fill: "#64748b" }}
        />
        <Line
          type="monotone"
          dataKey="synthetic_iv"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Synthetic"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="market_iv"
          stroke="#dc2626"
          strokeWidth={0}
          dot={{ r: 4, fill: "#dc2626" }}
          name="Market"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function mergeData(synthetic: IVSmilePoint[], market: MarketSmilePoint[]): MergedPoint[] {
  const map = new Map<string, MergedPoint>();

  for (const p of synthetic) {
    const key = p.moneyness.toFixed(4);
    map.set(key, { moneyness: p.moneyness, synthetic_iv: p.implied_vol });
  }

  for (const p of market) {
    const key = p.moneyness.toFixed(4);
    const existing = map.get(key);
    if (existing) {
      existing.market_iv = p.implied_vol;
      existing.strike = p.strike;
      existing.mid_price = p.mid_price;
      existing.bid = p.bid;
      existing.ask = p.ask;
      existing.open_interest = p.open_interest;
      existing.option_type = p.option_type;
    } else {
      map.set(key, {
        moneyness: p.moneyness,
        market_iv: p.implied_vol,
        strike: p.strike,
        mid_price: p.mid_price,
        bid: p.bid,
        ask: p.ask,
        open_interest: p.open_interest,
        option_type: p.option_type,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.moneyness - b.moneyness);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MarketTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MarketSmilePoint | undefined;
  if (!d) return null;
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div><strong>Strike: ${label}</strong></div>
      <div style={{ color: "#dc2626" }}>IV: {(d.implied_vol * 100).toFixed(2)}%</div>
      <div>Mid: ${d.mid_price.toFixed(2)}</div>
      <div>Bid: ${d.bid.toFixed(2)} / Ask: ${d.ask.toFixed(2)}</div>
      <div>OI: {d.open_interest.toLocaleString()} ({d.option_type})</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BothTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MergedPoint | undefined;
  if (!d) return null;
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div><strong>Moneyness: {d.moneyness.toFixed(4)}</strong></div>
      {d.synthetic_iv != null && (
        <div style={{ color: "#2563eb" }}>Synthetic: {(d.synthetic_iv * 100).toFixed(2)}%</div>
      )}
      {d.market_iv != null && (
        <div style={{ color: "#dc2626" }}>Market: {(d.market_iv * 100).toFixed(2)}%</div>
      )}
      {d.strike != null && <div>Strike: ${d.strike.toFixed(2)}</div>}
      {d.mid_price != null && <div>Mid: ${d.mid_price.toFixed(2)}</div>}
      {d.open_interest != null && <div>OI: {d.open_interest.toLocaleString()}</div>}
    </div>
  );
}
