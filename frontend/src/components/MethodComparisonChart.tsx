import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceResponse } from "../types/options";

interface Props {
  result: PriceResponse;
}

const METHODS = (r: PriceResponse) => [
  { name: "Black-Scholes", price: r.bs.price, color: "#2563eb" },
  { name: "Monte Carlo", price: r.mc.price, color: "#7c3aed" },
  { name: "Binomial (Eur)", price: r.binomial.european_price, color: "#0891b2" },
  { name: "Binomial (Am)", price: r.binomial.american_price, color: "#059669" },
];

export function MethodComparisonChart({ result }: Props) {
  const data = METHODS(result);

  return (
    <div className="chart-card">
      <h3>Method Comparison</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
          <Tooltip formatter={(v: unknown) => [`$${(v as number).toFixed(4)}`, "Price"]} />
          <ReferenceLine y={result.bs.price} stroke="#2563eb" strokeDasharray="4 4" />
          <Bar dataKey="price" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-note">Dashed line = Black-Scholes reference price</p>
    </div>
  );
}
