import type { Greeks, GreekKey } from "../types/options";

interface Props {
  greeks: Greeks;
}

const GREEK_INFO: Record<
  GreekKey,
  { label: string; description: string; fmt: (v: number) => string }
> = {
  delta: {
    label: "Delta (Δ)",
    description: "$1 move in spot → this change in option price",
    fmt: (v) => v.toFixed(4),
  },
  gamma: {
    label: "Gamma (Γ)",
    description: "$1 move in spot → this change in delta",
    fmt: (v) => v.toFixed(6),
  },
  vega: {
    label: "Vega (ν)",
    description: "1% move in vol → this change in option price",
    fmt: (v) => v.toFixed(4),
  },
  theta: {
    label: "Theta (Θ)",
    description: "1 calendar day passing → this change in option price",
    fmt: (v) => v.toFixed(4),
  },
  rho: {
    label: "Rho (ρ)",
    description: "1% move in risk-free rate → this change in option price",
    fmt: (v) => v.toFixed(4),
  },
};

const GREEK_KEYS: GreekKey[] = ["delta", "gamma", "vega", "theta", "rho"];

export function GreeksPanel({ greeks }: Props) {
  return (
    <div className="chart-card">
      <h3>Black-Scholes Greeks</h3>
      <table className="greeks-table">
        <thead>
          <tr>
            <th>Greek</th>
            <th>Value</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {GREEK_KEYS.map((key) => {
            const info = GREEK_INFO[key];
            return (
              <tr key={key}>
                <td className="greek-name">{info.label}</td>
                <td className="greek-value">{info.fmt(greeks[key])}</td>
                <td className="greek-desc">{info.description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
