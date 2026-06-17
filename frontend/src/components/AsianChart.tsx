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
import { asianPrice } from "../api/client";
import type { AsianPriceResponse, AsianType, OptionInputs } from "../types/options";
import { ASIAN_TYPE_LABELS } from "../types/options";

interface Props {
  inputs: OptionInputs;
}

const ASIAN_TYPES: AsianType[] = ["fixed_strike", "floating_strike"];

export function AsianChart({ inputs }: Props) {
  const [asianType, setAsianType] = useState<AsianType>("fixed_strike");
  const [nSamplePaths, setNSamplePaths] = useState(20);
  const [data, setData] = useState<AsianPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeRef = useRef(asianType);
  const samplePathsRef = useRef(nSamplePaths);

  function load(type: AsianType, nSample: number) {
    setLoading(true);
    setError(null);
    asianPrice(inputs, type, nSample)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to price Asian."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(typeRef.current, samplePathsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  function handleTypeChange(type: AsianType) {
    setAsianType(type);
    typeRef.current = type;
    load(type, samplePathsRef.current);
  }

  function handleSamplePathsCommit() {
    samplePathsRef.current = nSamplePaths;
    load(typeRef.current, nSamplePaths);
  }

  const chartData =
    data &&
    data.time_points.map((t, i) => {
      const point: Record<string, number> = { t };
      data.sample_paths.forEach((path, j) => {
        point[`p${j}`] = path.prices[i];
        point[`a${j}`] = path.averages[i];
      });
      return point;
    });

  return (
    <div className="chart-card wide">
      <h3>Asian Options (Monte Carlo)</h3>
      <p className="chart-subtitle">
        Path-dependent options whose payoff depends on the arithmetic average price.
        Thin lines show spot paths; thick <span style={{ color: "#f59e0b" }}>amber</span> lines
        show the running average converging as more observations accumulate.
      </p>

      <div className="chart-controls">
        <div className="control-group">
          <span className="control-label">Payoff Type</span>
          <div className="toggle-group">
            {ASIAN_TYPES.map((at) => (
              <button
                key={at}
                className={`toggle-btn${asianType === at ? " active" : ""}`}
                onClick={() => handleTypeChange(at)}
              >
                {ASIAN_TYPE_LABELS[at]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Sample paths: {nSamplePaths}</span>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={nSamplePaths}
            onChange={(e) => setNSamplePaths(Number(e.target.value))}
            onMouseUp={handleSamplePathsCommit}
            onTouchEnd={handleSamplePathsCommit}
          />
        </div>
      </div>

      {loading && <div className="chart-loading">Simulating paths...</div>}
      {error && <div className="chart-error">{error}</div>}

      {!loading && data && chartData && (
        <>
          <div className="summary-cards" style={{ marginBottom: 20 }}>
            <div className="summary-card">
              <div className="summary-card-label">Asian MC Price</div>
              <div className="summary-card-value">${data.mc_price.toFixed(4)}</div>
              <div className="summary-card-subvalue">
                95% CI: ${data.mc_confidence_lower.toFixed(4)} – ${data.mc_confidence_upper.toFixed(4)}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Vanilla BS Price</div>
              <div className="summary-card-value">${data.vanilla_price.toFixed(4)}</div>
              <div className="summary-card-subvalue">
                Asian discount: {((1 - data.mc_price / data.vanilla_price) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Mean Average Price</div>
              <div className="summary-card-value">${data.average_price_mean.toFixed(2)}</div>
              <div className="summary-card-subvalue">
                across {(data.n_paths / 1000).toFixed(0)}k paths ({data.n_steps} averaging points)
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="t"
                tickFormatter={(v: number) => `${v.toFixed(2)}`}
                tick={{ fontSize: 12 }}
                label={{ value: "Time (years)", position: "insideBottom", offset: -10, fontSize: 12, fill: "#475569" }}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 12 }}
                label={{ value: "Spot", angle: -90, position: "insideLeft", fontSize: 12, fill: "#475569" }}
              />
              <Tooltip
                formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`]}
                labelFormatter={(v: unknown) => `t = ${Number(v).toFixed(3)}`}
              />
              <ReferenceLine
                y={inputs.K}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: "Strike", position: "right", fontSize: 11, fill: "#64748b" }}
              />
              {data.sample_paths.map((_, j) => (
                <Line
                  key={`p${j}`}
                  type="monotone"
                  dataKey={`p${j}`}
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                  strokeOpacity={0.35}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {data.sample_paths.map((_, j) => (
                <Line
                  key={`a${j}`}
                  type="monotone"
                  dataKey={`a${j}`}
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  strokeOpacity={0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-note">
            {asianType === "fixed_strike"
              ? "Fixed strike: payoff = max(average − K, 0). Cheaper than vanilla because the average has lower volatility than the terminal price."
              : "Floating strike: payoff = max(S_T − average, 0). The average acts as the effective strike."}
          </p>
        </>
      )}
    </div>
  );
}
