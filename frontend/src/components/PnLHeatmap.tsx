import { useEffect, useState } from "react";
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    pnlHeatmap(inputs)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load heatmap."))
      .finally(() => setLoading(false));
  }, [inputs]);

  if (loading) return <div className="chart-card wide"><div className="chart-loading">Loading P&amp;L heatmap...</div></div>;
  if (error) return <div className="chart-card wide"><div className="chart-error">{error}</div></div>;
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
