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
