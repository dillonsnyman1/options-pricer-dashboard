import { useEffect, useState } from "react";
import { portfolioGreeks } from "../api/client";
import type { PortfolioGreeksResponse, PortfolioPosition } from "../types/options";

interface Props {
  positions: PortfolioPosition[];
}

function fmt(v: number, decimals = 2): string {
  const s = v.toFixed(decimals);
  return v >= 0 ? `+${s}` : s;
}

function dollarClass(v: number): string {
  if (v > 0) return "dollar-greek-positive";
  if (v < 0) return "dollar-greek-negative";
  return "";
}

export function PortfolioGreeksTable({ positions }: Props) {
  const [data, setData] = useState<PortfolioGreeksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const valid = positions.filter((p) => p.S > 0 && p.K > 0 && p.T > 0 && p.sigma > 0);
    if (valid.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    portfolioGreeks(valid)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load Greeks."))
      .finally(() => setLoading(false));
  }, [positions]);

  if (positions.length === 0) return null;
  if (loading) return <div className="chart-card wide"><div className="chart-loading">Calculating portfolio Greeks...</div></div>;
  if (error) return <div className="chart-card wide"><div className="chart-error">{error}</div></div>;
  if (!data) return null;

  return (
    <div className="chart-card wide">
      <h3>Portfolio Greeks (Dollar Terms)</h3>
      <p className="chart-subtitle">
        Per-position and net Greeks. Dollar Delta = qty x delta x S.
        Dollar Gamma = P&amp;L from a 1% spot move. Vega/Theta/Rho are per 1% vol / 1 day / 1% rate.
      </p>
      <div className="position-table-scroll">
        <table className="greeks-table portfolio-greeks-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Type</th>
              <th>S</th>
              <th>K</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Value</th>
              <th>Delta $</th>
              <th>Gamma $</th>
              <th>Vega $</th>
              <th>Theta $</th>
              <th>Rho $</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((p, i) => (
              <tr key={i}>
                <td>{p.ticker || "-"}</td>
                <td>{p.option_type}</td>
                <td>{p.S.toFixed(2)}</td>
                <td>{p.K.toFixed(2)}</td>
                <td className={p.quantity >= 0 ? "dollar-greek-positive" : "dollar-greek-negative"}>{p.quantity}</td>
                <td>{p.price.toFixed(4)}</td>
                <td className={dollarClass(p.position_value)}>{fmt(p.position_value)}</td>
                <td className={dollarClass(p.dollar_delta)}>{fmt(p.dollar_delta)}</td>
                <td className={dollarClass(p.dollar_gamma)}>{fmt(p.dollar_gamma)}</td>
                <td className={dollarClass(p.dollar_vega)}>{fmt(p.dollar_vega, 4)}</td>
                <td className={dollarClass(p.dollar_theta)}>{fmt(p.dollar_theta, 4)}</td>
                <td className={dollarClass(p.dollar_rho)}>{fmt(p.dollar_rho, 4)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="portfolio-net-row">
              <td colSpan={6}>Net Portfolio</td>
              <td className={dollarClass(data.net_position_value)}>{fmt(data.net_position_value)}</td>
              <td className={dollarClass(data.net_dollar_delta)}>{fmt(data.net_dollar_delta)}</td>
              <td className={dollarClass(data.net_dollar_gamma)}>{fmt(data.net_dollar_gamma)}</td>
              <td className={dollarClass(data.net_dollar_vega)}>{fmt(data.net_dollar_vega, 4)}</td>
              <td className={dollarClass(data.net_dollar_theta)}>{fmt(data.net_dollar_theta, 4)}</td>
              <td className={dollarClass(data.net_dollar_rho)}>{fmt(data.net_dollar_rho, 4)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
