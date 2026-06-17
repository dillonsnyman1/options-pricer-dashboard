import { useEffect, useState } from "react";
import "./App.css";
import { priceOption } from "./api/client";
import { BarrierChart } from "./components/BarrierChart";
import { GreeksPanel } from "./components/GreeksPanel";
import { GreeksSensitivityChart } from "./components/GreeksSensitivityChart";
import { IVSmileChart } from "./components/IVSmileChart";
import { MCConvergenceChart } from "./components/MCConvergenceChart";
import { MethodComparisonChart } from "./components/MethodComparisonChart";
import { OptionForm } from "./components/OptionForm";
import { PnLHeatmap } from "./components/PnLHeatmap";
import { PriceResultPanel } from "./components/PriceResultPanel";
import { DEFAULT_INPUTS, type OptionInputs, type PriceResponse } from "./types/options";

type Tab = "pricer" | "greeks" | "iv-smile" | "monte-carlo" | "pnl" | "exotics";

const TAB_LABELS: [Tab, string][] = [
  ["pricer", "Pricer"],
  ["greeks", "Greeks Sensitivity"],
  ["iv-smile", "IV Smile"],
  ["monte-carlo", "Monte Carlo"],
  ["pnl", "P&L Heatmap"],
  ["exotics", "Barrier Options"],
];

function App() {
  const [inputs, setInputs] = useState<OptionInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("pricer");

  function loadPrice(inp: OptionInputs) {
    setLoading(true);
    setError(null);
    priceOption(inp)
      .then(setResult)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Pricing failed."))
      .finally(() => setLoading(false));
  }

  function handleInputsChange(next: OptionInputs) {
    setInputs(next);
    loadPrice(next);
  }

  useEffect(() => {
    loadPrice(inputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Options Pricer &amp; Greeks Dashboard</h1>
        <p className="header-tagline">
          Black-Scholes, Monte Carlo with antithetic variates, and CRR binomial tree.
          Full Greeks, IV smile, and P&amp;L scenario analysis.
        </p>
        <p className="header-background">
          Options give the buyer the right, but not the obligation, to buy or sell an
          asset at a fixed price before a certain date. Pricing that right fairly is
          non-trivial: it depends on expected volatility, which is the only input you
          can't observe directly. Different models make different assumptions about the
          return distribution, and those differences matter most when options are deep
          in the money, near expiry, or American-style where early exercise is possible.
        </p>
      </header>

      <div className="toolbar">
        <OptionForm inputs={inputs} onChange={handleInputsChange} />
      </div>

      {loading && <div className="status-message">Calculating...</div>}
      {error && <div className="status-message error">{error}</div>}

      {result && !loading && (
        <>
          <PriceResultPanel result={result} />

          <div className="explore-guide">
            <span className="explore-label">What to try:</span>
            <ul className="explore-tips">
              <li>Switch to a <strong>put</strong> and move the strike deep ITM - the binomial American price will diverge from European as early exercise becomes attractive</li>
              <li>On the <strong>IV Smile</strong> tab, drag skew negative for the typical equity put skew, then increase curvature to add the symmetric smile</li>
              <li>The <strong>Monte Carlo</strong> tab shows the 95% CI collapsing as path count grows - noisy at 100 paths, within a cent of Black-Scholes at 200k</li>
              <li>The <strong>P&amp;L Heatmap</strong> shows position value across a grid of spot moves and vol shocks simultaneously</li>
              <li>The <strong>Barrier Options</strong> tab simulates paths that knock in or out at a barrier - drag the barrier slider to see how the discount vs. vanilla changes and watch which sample paths survive</li>
            </ul>
          </div>

          <nav className="tab-nav">
            {TAB_LABELS.map(([tab, label]) => (
              <button
                key={tab}
                className={`tab-button${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === "pricer" && (
              <div className="charts-row">
                <MethodComparisonChart result={result} />
                <GreeksPanel greeks={result.bs.greeks} />
              </div>
            )}
            {activeTab === "greeks" && <GreeksSensitivityChart inputs={inputs} />}
            {activeTab === "iv-smile" && <IVSmileChart inputs={inputs} />}
            {activeTab === "monte-carlo" && <MCConvergenceChart inputs={inputs} />}
            {activeTab === "pnl" && <PnLHeatmap inputs={inputs} />}
            {activeTab === "exotics" && <BarrierChart inputs={inputs} />}
          </div>
        </>
      )}
    </>
  );
}

export default App;
