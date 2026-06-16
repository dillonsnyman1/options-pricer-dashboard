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


class PriceRequest(BaseModel):
    S: float = Field(gt=0, description="Spot price")
    K: float = Field(gt=0, description="Strike price")
    T: float = Field(gt=0, description="Time to expiry in years")
    r: float = Field(description="Risk-free rate, e.g. 0.05 for 5%")
    sigma: float = Field(gt=0, description="Annualised volatility, e.g. 0.20 for 20%")
    option_type: OptionType


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
    option_type: OptionType
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
    option_type: OptionType


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
    option_type: OptionType


class PnLHeatmapResponse(BaseModel):
    spots: list[float]
    vols: list[float]
    pnl: list[list[float]]
    current_price: float
