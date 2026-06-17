from enum import Enum

from pydantic import BaseModel, Field


class OptionType(str, Enum):
    call = "call"
    put = "put"


class SensitivityParam(str, Enum):
    spot = "spot"
    vol = "vol"
    time = "time"
    rate = "rate"


class DividendPayment(BaseModel):
    t: float = Field(gt=0, description="Time of payment in years from today")
    D: float = Field(gt=0, description="Cash dividend amount")


class PriceRequest(BaseModel):
    S: float = Field(gt=0, description="Spot price")
    K: float = Field(gt=0, description="Strike price")
    T: float = Field(gt=0, description="Time to expiry in years")
    r: float = Field(description="Risk-free rate, e.g. 0.05 for 5%")
    sigma: float = Field(gt=0, description="Annualised volatility, e.g. 0.20 for 20%")
    q: float = Field(default=0.0, ge=0.0, description="Continuous dividend yield, e.g. 0.02 for 2%")
    option_type: OptionType
    n_paths: int = Field(default=200_000, ge=1_000, le=500_000, description="Monte Carlo simulation paths")
    n_steps: int = Field(default=500, ge=50, le=2_000, description="Binomial tree steps")
    discrete_dividends: list[DividendPayment] = Field(default_factory=list)


class Greeks(BaseModel):
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


class BSResult(BaseModel):
    price: float
    greeks: Greeks


class MCResult(BaseModel):
    price: float
    std_error: float
    n_paths: int
    confidence_lower: float
    confidence_upper: float


class BinomialResult(BaseModel):
    european_price: float
    american_price: float
    n_steps: int
    early_exercise_premium: float


class PriceResponse(BaseModel):
    bs: BSResult
    mc: MCResult
    binomial: BinomialResult


class GreeksSensitivityRequest(BaseModel):
    S: float = Field(gt=0)
    K: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    sigma: float = Field(gt=0)
    q: float = Field(default=0.0, ge=0.0)
    option_type: OptionType
    discrete_dividends: list[DividendPayment] = Field(default_factory=list)
    vary_param: SensitivityParam
    n_points: int = Field(default=60, ge=10, le=200)


class SensitivityPoint(BaseModel):
    param_value: float
    price: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


class IVSmileRequest(BaseModel):
    S: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    q: float = Field(default=0.0, ge=0.0)
    atm_vol: float = Field(gt=0, description="ATM implied volatility")
    skew: float = Field(default=-0.2, description="slope of the vol smile vs. log-moneyness (negative = put skew)")
    curvature: float = Field(default=0.5, ge=0, description="Vol smile curvature")
    n_strikes: int = Field(default=20, ge=5, le=60)
    strike_range_pct: float = Field(default=0.45, gt=0, le=1.0)


class IVSmilePoint(BaseModel):
    strike: float
    moneyness: float
    implied_vol: float
    call_price: float
    put_price: float


class MCConvergenceRequest(BaseModel):
    S: float = Field(gt=0)
    K: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    sigma: float = Field(gt=0)
    q: float = Field(default=0.0, ge=0.0)
    option_type: OptionType
    discrete_dividends: list[DividendPayment] = Field(default_factory=list)


class MCConvergencePoint(BaseModel):
    n_paths: int
    price: float
    std_error: float
    confidence_lower: float
    confidence_upper: float


class MCConvergenceResponse(BaseModel):
    bs_price: float
    paths: list[MCConvergencePoint]


class PnLHeatmapRequest(BaseModel):
    S: float = Field(gt=0)
    K: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    sigma: float = Field(gt=0)
    q: float = Field(default=0.0, ge=0.0)
    option_type: OptionType
    discrete_dividends: list[DividendPayment] = Field(default_factory=list)
    spot_range_pct: float = Field(default=0.4, gt=0, le=0.8, description="Spot range as ± fraction of S, e.g. 0.4 = ±40%")
    vol_range_mult: float = Field(default=2.5, gt=1.0, le=5.0, description="Vol range multiplier: shows sigma/mult to sigma*mult")


class PnLHeatmapResponse(BaseModel):
    spots: list[float]
    vols: list[float]
    pnl: list[list[float]]
    current_price: float


class BarrierType(str, Enum):
    down_and_out = "down_and_out"
    down_and_in = "down_and_in"
    up_and_out = "up_and_out"
    up_and_in = "up_and_in"


class BarrierPriceRequest(BaseModel):
    S: float = Field(gt=0)
    K: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    sigma: float = Field(gt=0)
    q: float = Field(default=0.0, ge=0.0)
    option_type: OptionType
    barrier: float = Field(gt=0, description="Barrier level")
    barrier_type: BarrierType
    n_paths: int = Field(default=200_000, ge=1_000, le=500_000)
    n_steps: int = Field(default=252, ge=50, le=1000, description="Monitoring steps (252 ≈ daily)")
    n_sample_paths: int = Field(default=20, ge=5, le=50, description="Sample paths for visualisation")


class SamplePath(BaseModel):
    prices: list[float]
    barrier_hit: bool


class BarrierPriceResponse(BaseModel):
    mc_price: float
    mc_std_error: float
    mc_confidence_lower: float
    mc_confidence_upper: float
    vanilla_price: float
    barrier_hit_pct: float
    n_paths: int
    n_monitoring_steps: int
    time_points: list[float]
    sample_paths: list[SamplePath]


class AsianType(str, Enum):
    fixed_strike = "fixed_strike"
    floating_strike = "floating_strike"


class AsianPriceRequest(BaseModel):
    S: float = Field(gt=0)
    K: float = Field(gt=0)
    T: float = Field(gt=0)
    r: float
    sigma: float = Field(gt=0)
    q: float = Field(default=0.0, ge=0.0)
    option_type: OptionType
    asian_type: AsianType = Field(default=AsianType.fixed_strike)
    n_paths: int = Field(default=200_000, ge=1_000, le=500_000)
    n_steps: int = Field(default=252, ge=50, le=1000)
    n_sample_paths: int = Field(default=20, ge=5, le=50)


class AsianSamplePath(BaseModel):
    prices: list[float]
    averages: list[float]


class AsianPriceResponse(BaseModel):
    mc_price: float
    mc_std_error: float
    mc_confidence_lower: float
    mc_confidence_upper: float
    vanilla_price: float
    average_price_mean: float
    n_paths: int
    n_steps: int
    time_points: list[float]
    sample_paths: list[AsianSamplePath]
