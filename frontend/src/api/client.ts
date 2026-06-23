import type {
  AsianPriceResponse,
  AsianType,
  BarrierPriceResponse,
  BarrierType,
  DividendPayment,
  IVSmilePoint,
  MarketSmileResponse,
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
  strike_range_pct = 0.25,
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

export function asianPrice(
  inputs: OptionInputs,
  asianType: AsianType,
  nSamplePaths = 20,
): Promise<AsianPriceResponse> {
  return post<AsianPriceResponse>("/api/asian-price", {
    ...inputs,
    asian_type: asianType,
    n_sample_paths: nSamplePaths,
  });
}

export function barrierPrice(
  inputs: OptionInputs,
  barrierLevel: number,
  barrierType: BarrierType,
  nSteps = 252,
  nSamplePaths = 20,
): Promise<BarrierPriceResponse> {
  return post<BarrierPriceResponse>("/api/barrier-price", {
    ...inputs,
    barrier: barrierLevel,
    barrier_type: barrierType,
    n_steps: nSteps,
    n_sample_paths: nSamplePaths,
  });
}

export async function spotPrice(ticker: string): Promise<{ ticker: string; spot: number }> {
  const res = await fetch(`${API_BASE}/api/spot/${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { detail?: string } | null)?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDividends(ticker: string, horizon: number): Promise<DividendPayment[]> {
  const res = await fetch(`${API_BASE}/api/dividends/${encodeURIComponent(ticker)}?horizon=${horizon}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { detail?: string } | null)?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function marketSmile(
  ticker: string,
  expiry: string | null = null,
  r = 0.05,
  q = 0.0,
  minOpenInterest = 10,
  dividendHorizonYears: number | null = null,
): Promise<MarketSmileResponse> {
  return post<MarketSmileResponse>("/api/market-smile", {
    ticker,
    expiry,
    r,
    q,
    min_open_interest: minOpenInterest,
    dividend_horizon_years: dividendHorizonYears,
  });
}

export function pnlHeatmap(
  inputs: OptionInputs,
  spotRangePct = 0.4,
  volRangeMult = 2.5,
): Promise<PnLHeatmapResponse> {
  return post<PnLHeatmapResponse>("/api/pnl-heatmap", {
    ...inputs,
    spot_range_pct: spotRangePct,
    vol_range_mult: volRangeMult,
  });
}
