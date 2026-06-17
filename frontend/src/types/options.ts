export type OptionType = "call" | "put";

export interface DividendPayment {
  t: number;
  D: number;
}

export type SensitivityParam = "spot" | "vol" | "time" | "rate";

export type GreekKey = "delta" | "gamma" | "vega" | "theta" | "rho";

export interface OptionInputs {
  S: number;
  K: number;
  T: number;
  r: number;
  sigma: number;
  q: number;
  option_type: OptionType;
  n_paths: number;
  n_steps: number;
  discrete_dividends: DividendPayment[];
}

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface BSResult {
  price: number;
  greeks: Greeks;
}

export interface MCResult {
  price: number;
  std_error: number;
  n_paths: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface BinomialResult {
  european_price: number;
  american_price: number;
  n_steps: number;
  early_exercise_premium: number;
}

export interface PriceResponse {
  bs: BSResult;
  mc: MCResult;
  binomial: BinomialResult;
}

export interface SensitivityPoint {
  param_value: number;
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface IVSmilePoint {
  strike: number;
  moneyness: number;
  implied_vol: number;
  call_price: number;
  put_price: number;
}

export interface MCConvergencePoint {
  n_paths: number;
  price: number;
  std_error: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface MCConvergenceResponse {
  bs_price: number;
  paths: MCConvergencePoint[];
}

export interface PnLHeatmapResponse {
  spots: number[];
  vols: number[];
  pnl: number[][];
  current_price: number;
}

export const SENSITIVITY_PARAM_LABELS: Record<SensitivityParam, string> = {
  spot: "Spot Price",
  vol: "Volatility",
  time: "Time to Expiry",
  rate: "Risk-free Rate",
};

export const GREEK_LABELS: Record<GreekKey, string> = {
  delta: "Delta",
  gamma: "Gamma",
  vega: "Vega",
  theta: "Theta",
  rho: "Rho",
};

export const ALL_GREEKS: GreekKey[] = ["delta", "gamma", "vega", "theta", "rho"];

export const DEFAULT_INPUTS: OptionInputs = {
  S: 100,
  K: 100,
  T: 1.0,
  r: 0.05,
  sigma: 0.2,
  q: 0,
  option_type: "call",
  n_paths: 200_000,
  n_steps: 500,
  discrete_dividends: [],
};
