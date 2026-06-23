import { useEffect, useState } from "react";
import "./App.css";
import { priceOption } from "./api/client";
import { AsianChart } from "./components/AsianChart";
import { BarrierChart } from "./components/BarrierChart";
import { GreeksPanel } from "./components/GreeksPanel";
import { GreeksSensitivityChart } from "./components/GreeksSensitivityChart";
import { IVSmileChart } from "./components/IVSmileChart";
import { MCConvergenceChart } from "./components/MCConvergenceChart";
import { MethodComparisonChart } from "./components/MethodComparisonChart";
import { OptionForm } from "./components/OptionForm";
import { PnLHeatmap } from "./components/PnLHeatmap";
import { PortfolioGreeksTable } from "./components/PortfolioGreeksTable";
import { PortfolioPnLHeatmap } from "./components/PortfolioPnLHeatmap";
import { PositionBuilder } from "./components/PositionBuilder";
import { PriceResultPanel } from "./components/PriceResultPanel";
import { DEFAULT_INPUTS, type OptionInputs, type PortfolioPosition, type PriceResponse } from "./types/options";

type AppMode = "single" | "portfolio";
type Tab = "pricer" | "greeks" | "iv-smile" | "monte-carlo" | "pnl" | "exotics";

const TAB_LABELS: [Tab, string][] = [
  ["pricer", "Pricer"],
  ["greeks", "Greeks Sensitivity"],
  ["iv-smile", "IV Smile"],
  ["monte-carlo", "Monte Carlo"],
  ["pnl", "P&L Heatmap"],
  ["exotics", "Exotics"],
];

function PositionSelector({ positions, selectedId, onChange }: {
  positions: PortfolioPosition[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="position-selector">
      <span className="control-label">Analyzing position:</span>
      <select
        value={selectedId ?? positions[0]?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {positions.map((p, i) => (
          <option key={p.id} value={p.id}>
            {p.ticker || `Position ${i + 1}`} - {p.option_type.charAt(0).toUpperCase() + p.option_type.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>("single");
  const [inputs, setInputs] = useState<OptionInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("pricer");
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

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

  function handleModeChange(next: AppMode) {
    setMode(next);
  }

  useEffect(() => {
    loadPrice(inputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function positionToInputs(pos: PortfolioPosition): OptionInputs {
    return {
      S: pos.S,
      K: pos.K,
      T: pos.T,
      r: pos.r,
      sigma: pos.sigma,
      q: pos.q,
      option_type: pos.option_type,
      n_paths: pos.n_paths,
      n_steps: pos.n_steps,
      discrete_dividends: pos.discrete_dividends,
    };
  }

  const selectedPosition = positions.find((p) => p.id === selectedPositionId) ?? positions[0] ?? null;
  const positionValid = selectedPosition != null && selectedPosition.S > 0 && selectedPosition.K > 0 && selectedPosition.T > 0 && selectedPosition.sigma > 0;
  const perPositionInputs = mode === "portfolio" && positionValid
    ? positionToInputs(selectedPosition)
    : inputs;
  const canRenderPerPosition = mode === "single" || positionValid;

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

      <nav className="mode-nav">
        <button
          className={`mode-nav-item${mode === "single" ? " active" : ""}`}
          onClick={() => handleModeChange("single")}
        >
          Single Option
        </button>
        <button
          className={`mode-nav-item${mode === "portfolio" ? " active" : ""}`}
          onClick={() => handleModeChange("portfolio")}
        >
          Portfolio{positions.length > 0 ? ` (${positions.length})` : ""}
        </button>
      </nav>

      <div className="toolbar">
        {mode === "single" && (
          <OptionForm inputs={inputs} onChange={handleInputsChange} />
        )}
        {mode === "portfolio" && (
          <PositionBuilder
            positions={positions}
            onChange={setPositions}
          />
        )}
      </div>

      {mode === "single" && (
        <>
          {loading && <div className="status-message">Calculating...</div>}
          {error && <div className="status-message error">{error}</div>}

          {result && !loading && (
            <>
              <PriceResultPanel result={result} />

              <div className="explore-guide">
                <span className="explore-label">What to try:</span>
                <ul className="explore-tips">
                  <li>Switch to a <strong>put</strong> and move the strike deep ITM - the binomial American price will diverge from European as early exercise becomes attractive</li>
                  <li>On the <strong>IV Smile</strong> tab, drag skew negative for the typical equity put skew, then switch to <strong>Market</strong> or <strong>Both</strong> to overlay real options chain IVs and see where the parametric model breaks down</li>
                  <li>The <strong>Monte Carlo</strong> tab shows the 95% CI collapsing as path count grows - noisy at 100 paths, within a cent of Black-Scholes at 200k</li>
                  <li>The <strong>P&amp;L Heatmap</strong> shows position value across a grid of spot moves and vol shocks simultaneously</li>
                  <li>The <strong>Exotics</strong> tab simulates barrier paths that knock in or out and Asian options where the payoff is on the average price - notice how the running average lines converge and the Asian discount vs. vanilla</li>
                  <li>Switch to <strong>Portfolio</strong> mode to build a multi-name book - add tickers, fetch market data, and see aggregated dollar Greeks and a combined P&amp;L heatmap with parallel percentage shocks</li>
                </ul>
              </div>
            </>
          )}
        </>
      )}

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
          <>
            {mode === "single" && result && !loading && (
              <div className="charts-row">
                <MethodComparisonChart result={result} />
                <GreeksPanel greeks={result.bs.greeks} />
              </div>
            )}
            {mode === "portfolio" && canRenderPerPosition && <PortfolioGreeksTable positions={positions} />}
            {mode === "portfolio" && !canRenderPerPosition && (
              <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
            )}
          </>
        )}
        {activeTab === "greeks" && canRenderPerPosition && (
          <>
            {mode === "portfolio" && positionValid && (
              <PositionSelector positions={positions} selectedId={selectedPosition?.id ?? null} onChange={setSelectedPositionId} />
            )}
            <GreeksSensitivityChart inputs={perPositionInputs} />
          </>
        )}
        {activeTab === "greeks" && !canRenderPerPosition && (
          <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
        )}
        {activeTab === "iv-smile" && canRenderPerPosition && (
          <>
            {mode === "portfolio" && positionValid && (
              <PositionSelector positions={positions} selectedId={selectedPosition?.id ?? null} onChange={setSelectedPositionId} />
            )}
            <IVSmileChart inputs={perPositionInputs} />
          </>
        )}
        {activeTab === "iv-smile" && !canRenderPerPosition && (
          <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
        )}
        {activeTab === "monte-carlo" && canRenderPerPosition && (
          <>
            {mode === "portfolio" && positionValid && (
              <PositionSelector positions={positions} selectedId={selectedPosition?.id ?? null} onChange={setSelectedPositionId} />
            )}
            <MCConvergenceChart inputs={perPositionInputs} />
          </>
        )}
        {activeTab === "monte-carlo" && !canRenderPerPosition && (
          <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
        )}
        {activeTab === "pnl" && (
          <>
            {mode === "single" && <PnLHeatmap inputs={inputs} />}
            {mode === "portfolio" && canRenderPerPosition && <PortfolioPnLHeatmap positions={positions} />}
            {mode === "portfolio" && !canRenderPerPosition && (
              <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
            )}
          </>
        )}
        {activeTab === "exotics" && canRenderPerPosition && (
          <>
            {mode === "portfolio" && positionValid && (
              <PositionSelector positions={positions} selectedId={selectedPosition?.id ?? null} onChange={setSelectedPositionId} />
            )}
            <BarrierChart inputs={perPositionInputs} />
            <AsianChart inputs={perPositionInputs} />
          </>
        )}
        {activeTab === "exotics" && !canRenderPerPosition && (
          <div className="chart-card wide"><p className="chart-subtitle">Fetch market data for your positions first.</p></div>
        )}
      </div>
    </>
  );
}

export default App;
