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
import { barrierPrice } from "../api/client";
import type { BarrierPriceResponse, BarrierType, OptionInputs } from "../types/options";
import { BARRIER_TYPE_LABELS } from "../types/options";

interface Props {
  inputs: OptionInputs;
}

const BARRIER_TYPES: BarrierType[] = ["down_and_out", "down_and_in", "up_and_out", "up_and_in"];

export function BarrierChart({ inputs }: Props) {
  const [barrierType, setBarrierType] = useState<BarrierType>("down_and_out");
  const [barrierLevel, setBarrierLevel] = useState(inputs.S * 0.85);
  const [nSamplePaths, setNSamplePaths] = useState(20);
  const [data, setData] = useState<BarrierPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barrierRef = useRef(barrierLevel);
  const typeRef = useRef(barrierType);
  const samplePathsRef = useRef(nSamplePaths);

  function load(level: number, type: BarrierType, nSample: number) {
    setLoading(true);
    setError(null);
    barrierPrice(inputs, level, type, 252, nSample)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to price barrier."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setBarrierLevel(inputs.S * 0.85);
    barrierRef.current = inputs.S * 0.85;
    load(inputs.S * 0.85, typeRef.current, samplePathsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  function handleBarrierCommit() {
    barrierRef.current = barrierLevel;
    load(barrierLevel, typeRef.current, samplePathsRef.current);
  }

  function handleTypeChange(type: BarrierType) {
    setBarrierType(type);
    typeRef.current = type;
    load(barrierRef.current, type, samplePathsRef.current);
  }

  function handleSamplePathsCommit() {
    samplePathsRef.current = nSamplePaths;
    load(barrierRef.current, typeRef.current, nSamplePaths);
  }

  const chartData =
    data &&
    data.time_points.map((t, i) => {
      const point: Record<string, number> = { t };
      data.sample_paths.forEach((path, j) => {
        point[`p${j}`] = path.prices[i];
      });
      return point;
    });

  return (
    <div className="chart-card wide">
      <h3>Barrier Options (Monte Carlo)</h3>
      <p className="chart-subtitle">
        Path-dependent options that knock in or out when the underlying hits a barrier.
        Sample paths shown below — <span style={{ color: "#2563eb" }}>blue</span> paths
        survive, <span style={{ color: "#ef4444" }}>red</span> paths hit the barrier.
      </p>

      <div className="chart-controls">
        <div className="control-group">
          <span className="control-label">Barrier Type</span>
          <div className="toggle-group">
            {BARRIER_TYPES.map((bt) => (
              <button
                key={bt}
                className={`toggle-btn${barrierType === bt ? " active" : ""}`}
                onClick={() => handleTypeChange(bt)}
              >
                {BARRIER_TYPE_LABELS[bt]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Barrier: ${barrierLevel.toFixed(1)}</span>
          <input
            type="range"
            min={inputs.S * 0.5}
            max={inputs.S * 1.5}
            step={inputs.S * 0.005}
            value={barrierLevel}
            onChange={(e) => setBarrierLevel(Number(e.target.value))}
            onMouseUp={handleBarrierCommit}
            onTouchEnd={handleBarrierCommit}
          />
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
              <div className="summary-card-label">Barrier MC Price</div>
              <div className="summary-card-value">${data.mc_price.toFixed(4)}</div>
              <div className="summary-card-subvalue">
                95% CI: ${data.mc_confidence_lower.toFixed(4)} – ${data.mc_confidence_upper.toFixed(4)}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Vanilla BS Price</div>
              <div className="summary-card-value">${data.vanilla_price.toFixed(4)}</div>
              <div className="summary-card-subvalue">
                Barrier discount: {((1 - data.mc_price / data.vanilla_price) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Barrier Hit Rate</div>
              <div className="summary-card-value">{data.barrier_hit_pct.toFixed(1)}%</div>
              <div className="summary-card-subvalue">
                of {(data.n_paths / 1000).toFixed(0)}k paths ({data.n_monitoring_steps} monitoring steps)
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
                y={barrierLevel}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="6 3"
                label={{ value: "Barrier", position: "right", fontSize: 11, fill: "#f97316" }}
              />
              <ReferenceLine
                y={inputs.K}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: "Strike", position: "right", fontSize: 11, fill: "#64748b" }}
              />
              {data.sample_paths.map((path, j) => (
                <Line
                  key={j}
                  type="monotone"
                  dataKey={`p${j}`}
                  stroke={path.barrier_hit ? "#ef4444" : "#2563eb"}
                  strokeWidth={1}
                  strokeOpacity={0.55}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-note">
            {barrierType.includes("out") ? "Knock-out" : "Knock-in"}: paths that{" "}
            {barrierType.includes("out") ? "hit" : "never hit"} the barrier produce zero payoff.
            MC uses discrete monitoring ({data.n_monitoring_steps} steps); continuous barriers would show slightly different prices.
          </p>
        </>
      )}
    </div>
  );
}
