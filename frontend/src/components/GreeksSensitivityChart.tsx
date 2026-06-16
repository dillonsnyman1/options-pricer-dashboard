import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { greeksSensitivity } from "../api/client";
import {
  ALL_GREEKS,
  GREEK_LABELS,
  SENSITIVITY_PARAM_LABELS,
  type GreekKey,
  type OptionInputs,
  type SensitivityParam,
  type SensitivityPoint,
} from "../types/options";

const GREEK_COLORS: Record<GreekKey, string> = {
  delta: "#2563eb",
  gamma: "#7c3aed",
  vega: "#0891b2",
  theta: "#b91c1c",
  rho: "#059669",
};

interface Props {
  inputs: OptionInputs;
}

export function GreeksSensitivityChart({ inputs }: Props) {
  const [varyParam, setVaryParam] = useState<SensitivityParam>("spot");
  const [selected, setSelected] = useState<Set<GreekKey>>(new Set(["delta", "gamma"]));
  const [data, setData] = useState<SensitivityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGreek(g: GreekKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(g) && next.size > 1) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    greeksSensitivity(inputs, varyParam)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load sensitivity data."),
      )
      .finally(() => setLoading(false));
  }, [inputs, varyParam]);

  const xFmt = (v: number) => {
    if (varyParam === "vol" || varyParam === "rate") return `${(v * 100).toFixed(1)}%`;
    if (varyParam === "time") return v.toFixed(2);
    return v.toFixed(1);
  };

  return (
    <div className="chart-card wide">
      <h3>Greeks Sensitivity</h3>

      <div className="chart-controls">
        <div className="control-group">
          <span className="control-label">Vary</span>
          <div className="toggle-group">
            {(["spot", "vol", "time", "rate"] as SensitivityParam[]).map((p) => (
              <button
                key={p}
                className={`toggle-btn${varyParam === p ? " active" : ""}`}
                onClick={() => setVaryParam(p)}
              >
                {SENSITIVITY_PARAM_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Greeks</span>
          <div className="toggle-group">
            {ALL_GREEKS.map((g) => (
              <button
                key={g}
                className={`toggle-btn${selected.has(g) ? " active" : ""}`}
                style={selected.has(g) ? { background: GREEK_COLORS[g], borderColor: GREEK_COLORS[g] } : {}}
                onClick={() => toggleGreek(g)}
              >
                {GREEK_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">{error}</div>}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="param_value"
              tickFormatter={xFmt}
              tick={{ fontSize: 12 }}
              label={{
                value: SENSITIVITY_PARAM_LABELS[varyParam],
                position: "insideBottom",
                offset: -10,
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(v: unknown) => `${SENSITIVITY_PARAM_LABELS[varyParam]}: ${xFmt(v as number)}`}
              formatter={(v: unknown, name: unknown) => [(v as number).toFixed(6), GREEK_LABELS[name as GreekKey] ?? String(name)]}
            />
            <Legend verticalAlign="top" />
            {ALL_GREEKS.filter((g) => selected.has(g)).map((g) => (
              <Line
                key={g}
                type="monotone"
                dataKey={g}
                stroke={GREEK_COLORS[g]}
                dot={false}
                strokeWidth={2}
                name={g}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
