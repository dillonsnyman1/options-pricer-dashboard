import { useEffect, useRef, useState } from "react";
import { pnlHeatmap } from "../api/client";
import type { OptionInputs, PnLHeatmapResponse } from "../types/options";

interface Props {
  inputs: OptionInputs;
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

export function PnLHeatmap({ inputs }: Props) {
  const [data, setData] = useState<PnLHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotRangePct, setSpotRangePct] = useState(0.4);
  const [volRangeMult, setVolRangeMult] = useState(2.5);
  const spotRangeRef = useRef(spotRangePct);
  const volRangeRef = useRef(volRangeMult);

  function load(spot: number, vol: number) {
    setLoading(true);
    setError(null);
    pnlHeatmap(inputs, spot, vol)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load heatmap."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(spotRangeRef.current, volRangeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  function handleSpotRangeCommit() {
    spotRangeRef.current = spotRangePct;
    load(spotRangePct, volRangeRef.current);
  }

  function handleVolRangeCommit() {
    volRangeRef.current = volRangeMult;
    load(spotRangeRef.current, volRangeMult);
  }

  const controls = (
    <div className="chart-controls">
      <div className="control-group">
        <span className="control-label">Spot range: ±{(spotRangePct * 100).toFixed(0)}%</span>
        <input
          type="range"
          min="0.1"
          max="0.8"
          step="0.05"
          value={spotRangePct}
          onChange={(e) => setSpotRangePct(Number(e.target.value))}
          onMouseUp={handleSpotRangeCommit}
          onTouchEnd={handleSpotRangeCommit}
        />
      </div>
      <div className="control-group">
        <span className="control-label">Vol range: ×{volRangeMult.toFixed(1)}</span>
        <input
          type="range"
          min="1.25"
          max="5"
          step="0.25"
          value={volRangeMult}
          onChange={(e) => setVolRangeMult(Number(e.target.value))}
          onMouseUp={handleVolRangeCommit}
          onTouchEnd={handleVolRangeCommit}
        />
      </div>
    </div>
  );

  if (loading) return <div className="chart-card wide">{controls}<div className="chart-loading">Loading P&amp;L heatmap...</div></div>;
  if (error) return <div className="chart-card wide">{controls}<div className="chart-error">{error}</div></div>;
  if (!data) return null;

  const allPnl = data.pnl.flat();
  const maxAbs = Math.max(...allPnl.map(Math.abs), 0.01);

  const CELL_W = 52;
  const CELL_H = 30;
  const LABEL_W = 52;
  const LABEL_H = 32;
  const svgWidth = LABEL_W + data.spots.length * CELL_W;
  const svgHeight = LABEL_H + data.vols.length * CELL_H + 20;

  const reversedVols = [...data.vols].reverse();

  return (
    <div className="chart-card wide">
      <h3>P&amp;L Heatmap: Option Price Change vs. Today</h3>
      {controls}
      <p className="chart-subtitle">
        Green = gain vs. today&rsquo;s price (${data.current_price.toFixed(4)}). Red = loss.
        Rows: volatility (bottom = low, top = high). Columns: spot price (left = low, right = high).
      </p>
      <div className="heatmap-scroll">
        <svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          {/* Spot column headers */}
          {data.spots.map((s, j) => (
            <text
              key={j}
              x={LABEL_W + j * CELL_W + CELL_W / 2}
              y={LABEL_H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
            >
              {s.toFixed(0)}
            </text>
          ))}

          {/* Vol row labels + cells */}
          {reversedVols.map((v, i) => {
            const rowIdx = data.vols.length - 1 - i;
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
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={LABEL_W + (data.spots.length * CELL_W) / 2}
            y={svgHeight - 2}
            textAnchor="middle"
            fontSize={11}
            fill="#475569"
          >
            Spot Price →
          </text>
          <text
            x={10}
            y={LABEL_H + (data.vols.length * CELL_H) / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#475569"
            transform={`rotate(-90, 10, ${LABEL_H + (data.vols.length * CELL_H) / 2})`}
          >
            Vol →
          </text>
        </svg>
      </div>
    </div>
  );
}
