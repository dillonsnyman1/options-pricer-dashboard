import type {
  IVSmilePoint,
  MCConvergenceResponse,
  OptionInputs,
  PnLHeatmapResponse,
  PriceResponse,
  SensitivityParam,
  SensitivityPoint,
} from "../types/options";

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { detail?: string } | null)?.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function priceOption(inputs: OptionInputs): Promise<PriceResponse> {
  return post<PriceResponse>("/api/price", inputs);
}

export function greeksSensitivity(
  inputs: OptionInputs,
  vary_param: SensitivityParam,
  n_points = 60,
): Promise<SensitivityPoint[]> {
  return post<SensitivityPoint[]>("/api/greeks-sensitivity", { ...inputs, vary_param, n_points });
}

export function ivSmile(
  inputs: OptionInputs,
  skew: number,
  curvature: number,
  n_strikes = 20,
  strike_range_pct = 0.45,
): Promise<IVSmilePoint[]> {
  return post<IVSmilePoint[]>("/api/iv-smile", {
    S: inputs.S,
    T: inputs.T,
    r: inputs.r,
    atm_vol: inputs.sigma,
    skew,
    curvature,
    n_strikes,
    strike_range_pct,
  });
}

export function mcConvergence(inputs: OptionInputs): Promise<MCConvergenceResponse> {
  return post<MCConvergenceResponse>("/api/mc-convergence", inputs);
}

export function pnlHeatmap(inputs: OptionInputs): Promise<PnLHeatmapResponse> {
  return post<PnLHeatmapResponse>("/api/pnl-heatmap", inputs);
}
