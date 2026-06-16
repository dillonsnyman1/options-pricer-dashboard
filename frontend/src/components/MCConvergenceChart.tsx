import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mcConvergence } from "../api/client";
import type { MCConvergenceResponse, OptionInputs } from "../types/options";

interface Props {
  inputs: OptionInputs;
}

interface ChartRow {
  n_paths: number;
  price: number;
  lower: number;
  upper: number;
}

export function MCConvergenceChart({ inputs }: Props) {
  const [data, setData] = useState<MCConvergenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    mcConvergence(inputs)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load convergence data."))
      .finally(() => setLoading(false));
  }, [inputs]);

  const chartData: ChartRow[] | undefined = data?.paths.map((p) => ({
    n_paths: p.n_paths,
    price: p.price,
    lower: p.confidence_lower,
    upper: p.confidence_upper,
  }));

  return (
    <div className="chart-card wide">
      <h3>Monte Carlo Convergence</h3>
      <p className="chart-subtitle">
        MC price with 95% CI as path count increases (log scale). Antithetic variates halve the
        variance vs. naive simulation. Red dashed line is the Black-Scholes reference.
      </p>

      {loading && <div className="chart-loading">Loading...</div>}
      {error && <div className="chart-error">{error}</div>}

      {!loading && data && chartData && (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 80, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="n_paths"
              scale="log"
              domain={["dataMin", "dataMax"]}
              type="number"
              tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              tick={{ fontSize: 12 }}
              label={{
                value: "Number of Paths",
                position: "insideBottom",
                offset: -10,
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => {
                const labels: Record<string, string> = {
                  price: "MC Price",
                  lower: "95% CI Lower",
                  upper: "95% CI Upper",
                };
                const key = String(name);
                return [`$${(v as number).toFixed(4)}`, labels[key] ?? key];
              }}
              labelFormatter={(v: unknown) => `Paths: ${Number(v).toLocaleString()}`}
            />
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#eff6ff"
              fillOpacity={1}
              legendType="none"
              stackId="band"
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              legendType="none"
              stackId="band"
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: "#2563eb" }}
              name="MC Price"
            />
            <ReferenceLine
              y={data.bs_price}
              stroke="#b91c1c"
              strokeDasharray="5 4"
              label={{
                value: `BS $${data.bs_price.toFixed(4)}`,
                position: "right",
                fontSize: 11,
                fill: "#b91c1c",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
