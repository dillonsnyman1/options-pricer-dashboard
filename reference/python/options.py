"""
Black-Scholes option pricing, Greeks, Newton-Raphson IV solver,
Monte Carlo with antithetic variates, and CRR binomial tree.

No external dependencies - uses math.erf for the normal CDF and
random.gauss for Monte Carlo draws.

All functions follow the same parameter convention:
  S           - spot price
  K           - strike price
  T           - time to expiry in years
  r           - continuous risk-free rate (e.g. 0.05 for 5%)
  sigma       - annualised volatility (e.g. 0.20 for 20%)
  option_type - 'call' or 'put'

Vega and Rho are scaled to a 1% move. Theta is per calendar day.
"""

import math
import random


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def _d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple:
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def bs_price(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    disc = math.exp(-r * T)
    if option_type == "call":
        return S * _norm_cdf(d1) - K * disc * _norm_cdf(d2)
    return K * disc * _norm_cdf(-d2) - S * _norm_cdf(-d1)


def bs_greeks(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> dict:
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    phi = _norm_pdf(d1)
    sqrt_T = math.sqrt(T)
    disc = math.exp(-r * T)

    delta = _norm_cdf(d1) if option_type == "call" else _norm_cdf(d1) - 1.0
    gamma = phi / (S * sigma * sqrt_T)
    vega = S * phi * sqrt_T / 100.0  # per 1% move in vol

    if option_type == "call":
        theta = (-(S * phi * sigma / (2.0 * sqrt_T)) - r * K * disc * _norm_cdf(d2)) / 365.0
        rho = K * T * disc * _norm_cdf(d2) / 100.0  # per 1% move in rate
    else:
        theta = (-(S * phi * sigma / (2.0 * sqrt_T)) + r * K * disc * _norm_cdf(-d2)) / 365.0
        rho = -K * T * disc * _norm_cdf(-d2) / 100.0

    return {"delta": delta, "gamma": gamma, "vega": vega, "theta": theta, "rho": rho}


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
    """Newton-Raphson: iterate sigma until BS(sigma) = market_price."""
    sigma = 0.2
    for _ in range(max_iter):
        p = bs_price(S, K, T, r, sigma, option_type)
        d1, _ = _d1_d2(S, K, T, r, sigma)
        vega_raw = S * _norm_pdf(d1) * math.sqrt(T)  # unscaled, used as derivative
        diff = p - market_price
        if abs(diff) < tol:
            return sigma
        if abs(vega_raw) < 1e-12:
            break
        sigma -= diff / vega_raw
        sigma = max(1e-6, min(sigma, 10.0))  # keep sigma in a sane range
    return sigma


def monte_carlo(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    n_paths: int = 100_000,
    seed: int = 42,
) -> dict:
    """
    Price via Monte Carlo with antithetic variates.

    Each standard normal draw Z is paired with -Z. For monotone payoffs,
    f(Z) and f(-Z) are negatively correlated, so averaging them reduces
    variance compared to two independent draws.
    """
    rng = random.Random(seed)
    half = n_paths // 2
    disc = math.exp(-r * T)
    drift = (r - 0.5 * sigma ** 2) * T
    vol_t = sigma * math.sqrt(T)

    payoffs = []
    for _ in range(half):
        z = rng.gauss(0.0, 1.0)
        for sign in (1.0, -1.0):
            ST = S * math.exp(drift + vol_t * sign * z)
            pf = max(ST - K, 0.0) if option_type == "call" else max(K - ST, 0.0)
            payoffs.append(disc * pf)

    n = len(payoffs)
    mean = sum(payoffs) / n
    variance = sum((p - mean) ** 2 for p in payoffs) / (n - 1)
    std_error = math.sqrt(variance / n)

    return {"price": mean, "std_error": std_error, "n_paths": n_paths}


def binomial_tree(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    n_steps: int = 200,
) -> dict:
    """
    CRR binomial tree returning both European and American prices.

    The early exercise premium (American - European) is most significant
    for deep ITM puts. For calls on a non-dividend-paying stock it is
    always zero (never optimal to exercise early).
    """
    dt = T / n_steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    p = (math.exp(r * dt) - d) / (u - d)
    disc = math.exp(-r * dt)

    def payoff(s):
        return max(s - K, 0.0) if option_type == "call" else max(K - s, 0.0)

    # Terminal stock prices and payoffs
    V_eur = [payoff(S * u ** (n_steps - j) * d ** j) for j in range(n_steps + 1)]
    V_am = V_eur[:]

    # European: straightforward backward induction
    for _ in range(n_steps):
        V_eur = [disc * (p * V_eur[j] + (1.0 - p) * V_eur[j + 1]) for j in range(len(V_eur) - 1)]

    # American: same induction but check intrinsic at every node
    for i in range(n_steps - 1, -1, -1):
        V_am = [disc * (p * V_am[j] + (1.0 - p) * V_am[j + 1]) for j in range(i + 1)]
        for j in range(i + 1):
            intrinsic = payoff(S * u ** (i - j) * d ** j)
            V_am[j] = max(V_am[j], intrinsic)

    eur = V_eur[0]
    am = V_am[0]
    return {
        "european_price": eur,
        "american_price": am,
        "early_exercise_premium": am - eur,
    }
