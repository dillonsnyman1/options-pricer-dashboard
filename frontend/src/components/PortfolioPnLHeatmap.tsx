import { useEffect, useRef, useState } from "react";
import { portfolioPnlHeatmap } from "../api/client";
import type { PortfolioPnLHeatmapResponse, PortfolioPosition } from "../types/options";

interface Props {
  positions: PortfolioPosition[];
}

function pnlColor(pnl: number, maxAbs: number): string {
  const t = Math.max(-1, Math.min(1, pnl / maxAbs));
  if (t >= 0) {
    const i = Math.round(t * 200);
    return `rgb(${55 + (200 - i)}, ${160 + Math.round((1 - t) * 95)}, ${55 + (200 - i)})`;
  }
  const i = Math.round(-t * 200);
  return `rgb(${160 + Math.round((1 + t) * 95)}, ${55 + (200 - i)}, ${55 + (200 - i)})`;
}

export function PortfolioPnLHeatmap({ positions }: Props) {
  const [data, setData] = useState<PortfolioPnLHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotRange, setSpotRange] = useState(0.2);
  const [volRange, setVolRange] = useState(0.5);
  const spotRef = useRef(spotRange);
  const volRef = useRef(volRange);

  function load(sr: number, vr: number) {
    const valid = positions.filter((p) => p.S > 0 && p.K > 0 && p.T > 0 && p.sigma > 0);
    if (valid.length === 0) return;
    setLoading(true);
    setError(null);
    portfolioPnlHeatmap(valid, sr, vr)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load heatmap."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(spotRef.current, volRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  function handleSpotCommit() {
    spotRef.current = spotRange;
    load(spotRange, volRef.current);
  }

  function handleVolCommit() {
    volRef.current = volRange;
    load(spotRef.current, volRange);
  }

  if (positions.length === 0) return null;

  const controls = (
    <div className="chart-controls">
      <div className="control-group">
        <span className="control-label">Spot shock: +/-{(spotRange * 100).toFixed(0)}%</span>
        <input
          type="range"
          min="0.05"
          max="0.5"
          step="0.05"
          value={spotRange}
          onChange={(e) => setSpotRange(Number(e.target.value))}
          onMouseUp={handleSpotCommit}
          onTouchEnd={handleSpotCommit}
        />
      </div>
      <div className="control-group">
        <span className="control-label">Vol shock: -{(volRange * 100).toFixed(0)}% / +{(volRange * 200).toFixed(0)}%</span>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.1"
          value={volRange}
          onChange={(e) => setVolRange(Number(e.target.value))}
          onMouseUp={handleVolCommit}
          onTouchEnd={handleVolCommit}
        />
      </div>
    </div>
  );

  if (loading) return <div className="chart-card wide">{controls}<div className="chart-loading">Loading portfolio P&amp;L heatmap...</div></div>;
  if (error) return <div className="chart-card wide">{controls}<div className="chart-error">{error}</div></div>;
  if (!data) return null;

  const allPnl = data.pnl.flat();
  const maxAbs = Math.max(...allPnl.map(Math.abs), 0.01);

  const CELL_W = 52;
  const CELL_H = 30;
  const LABEL_W = 56;
  const LABEL_H = 32;
  const svgWidth = LABEL_W + data.spot_shocks.length * CELL_W;
  const svgHeight = LABEL_H + data.vol_shocks.length * CELL_H + 20;

  const reversedVolShocks = [...data.vol_shocks].reverse();

  return (
    <div className="chart-card wide">
      <h3>Portfolio P&amp;L Heatmap: Parallel Shocks</h3>
      {controls}
      <p className="chart-subtitle">
        Combined P&amp;L across all positions under parallel spot and vol shocks.
        Current portfolio value: ${data.current_portfolio_value.toFixed(2)}.
        Green = gain, Red = loss.
      </p>
      <div className="heatmap-scroll">
        <svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          {data.spot_shocks.map((s, j) => (
            <text
              key={j}
              x={LABEL_W + j * CELL_W + CELL_W / 2}
              y={LABEL_H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
            >
              {(s * 100).toFixed(0)}%
            </text>
          ))}

          {reversedVolShocks.map((v, i) => {
            const rowIdx = data.vol_shocks.length - 1 - i;
            const row = data.pnl[rowIdx];
            return (
              <g key={i}>
                <text
                  x={LABEL_W - 4}
                  y={LABEL_H + i * CELL_H + CELL_H / 2 + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#475569"
                >
                  {(v * 100).toFixed(0)}%
                </text>
                {row.map((pnl, j) => (
                  <g key={j}>
                    <rect
                      x={LABEL_W + j * CELL_W}
                      y={LABEL_H + i * CELL_H}
                      width={CELL_W - 1}
                      height={CELL_H - 1}
                      fill={pnlColor(pnl, maxAbs)}
                    />
                    <text
                      x={LABEL_W + j * CELL_W + CELL_W / 2}
                      y={LABEL_H + i * CELL_H + CELL_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#0f172a"
                    >
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          <text
            x={LABEL_W + (data.spot_shocks.length * CELL_W) / 2}
            y={svgHeight - 2}
            textAnchor="middle"
            fontSize={11}
            fill="#475569"
          >
            Spot Shock % &rarr;
          </text>
          <text
            x={10}
            y={LABEL_H + (data.vol_shocks.length * CELL_H) / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#475569"
            transform={`rotate(-90, 10, ${LABEL_H + (data.vol_shocks.length * CELL_H) / 2})`}
          >
            Vol Shock % &rarr;
          </text>
        </svg>
      </div>
    </div>
  );
}
