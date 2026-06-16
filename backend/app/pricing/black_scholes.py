import numpy as np
from scipy.stats import norm


def _d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return d1, d2


def price(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    if option_type == "call":
        return float(S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
    return float(K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))


def greeks(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> dict:
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    phi = norm.pdf(d1)
    sqrt_T = np.sqrt(T)
    disc = np.exp(-r * T)

    delta = float(norm.cdf(d1) if option_type == "call" else norm.cdf(d1) - 1.0)
    gamma = float(phi / (S * sigma * sqrt_T))
    vega = float(S * phi * sqrt_T / 100)  # per 1% move in vol

    if option_type == "call":
        theta = float((-(S * phi * sigma / (2 * sqrt_T)) - r * K * disc * norm.cdf(d2)) / 365)
        rho = float(K * T * disc * norm.cdf(d2) / 100)
    else:
        theta = float((-(S * phi * sigma / (2 * sqrt_T)) + r * K * disc * norm.cdf(-d2)) / 365)
        rho = float(-K * T * disc * norm.cdf(-d2) / 100)

    return {"delta": delta, "gamma": gamma, "vega": vega, "theta": theta, "rho": rho}


def _vega_raw(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Unscaled vega (∂C/∂σ), used in Newton-Raphson IV solver."""
    d1, _ = _d1_d2(S, K, T, r, sigma)
    return float(S * norm.pdf(d1) * np.sqrt(T))


def implied_vol(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str,
    tol: float = 1e-7,
    max_iter: int = 100,
) -> float:
    sigma = 0.2
    for _ in range(max_iter):
        p = price(S, K, T, r, sigma, option_type)
        v = _vega_raw(S, K, T, r, sigma)
        diff = p - market_price
        if abs(diff) < tol:
            return sigma
        if abs(v) < 1e-12:
            break
        sigma -= diff / v
        sigma = max(1e-6, min(sigma, 10.0))
    return sigma
