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
import { ivSmile } from "../api/client";
import type { IVSmilePoint, OptionInputs } from "../types/options";

interface Props {
  inputs: OptionInputs;
}

export function IVSmileChart({ inputs }: Props) {
  const [skew, setSkew] = useState(-0.2);
  const [curvature, setCurvature] = useState(0.5);
  const [data, setData] = useState<IVSmilePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skewRef = useRef(skew);
  const curvatureRef = useRef(curvature);

  function load(s: number, c: number) {
    setLoading(true);
    setError(null);
    ivSmile(inputs, s, c)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load IV smile."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(skewRef.current, curvatureRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  function handleSkewCommit() {
    skewRef.current = skew;
    load(skew, curvatureRef.current);
  }

  function handleCurvatureCommit() {
    curvatureRef.current = curvature;
    load(skewRef.current, curvature);
  }

  return (
    <div className="chart-card wide">
      <h3>Implied Volatility Smile</h3>
      <p className="chart-subtitle">
        Parametric smile: σ(K) = σ_ATM + skew·ln(K/S) + curvature·ln(K/S)². IVs are backed
        out from the generated prices via Newton-Raphson.
      </p>

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
      </div>

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">{error}</div>}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
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
              x={inputs.S}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: "ATM", position: "top", fontSize: 11, fill: "#64748b" }}
            />
            <Line type="monotone" dataKey="implied_vol" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
