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

export type BarrierType = "down_and_out" | "down_and_in" | "up_and_out" | "up_and_in";

export interface SamplePath {
  prices: number[];
  barrier_hit: boolean;
}

export interface BarrierPriceResponse {
  mc_price: number;
  mc_std_error: number;
  mc_confidence_lower: number;
  mc_confidence_upper: number;
  vanilla_price: number;
  barrier_hit_pct: number;
  n_paths: number;
  n_monitoring_steps: number;
  time_points: number[];
  sample_paths: SamplePath[];
}

export type AsianType = "fixed_strike" | "floating_strike";

export interface AsianSamplePath {
  prices: number[];
  averages: number[];
}

export interface AsianPriceResponse {
  mc_price: number;
  mc_std_error: number;
  mc_confidence_lower: number;
  mc_confidence_upper: number;
  vanilla_price: number;
  average_price_mean: number;
  n_paths: number;
  n_steps: number;
  time_points: number[];
  sample_paths: AsianSamplePath[];
}

export const ASIAN_TYPE_LABELS: Record<AsianType, string> = {
  fixed_strike: "Fixed Strike",
  floating_strike: "Floating Strike",
};

export const BARRIER_TYPE_LABELS: Record<BarrierType, string> = {
  down_and_out: "Down-and-Out",
  down_and_in: "Down-and-In",
  up_and_out: "Up-and-Out",
  up_and_in: "Up-and-In",
};

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
