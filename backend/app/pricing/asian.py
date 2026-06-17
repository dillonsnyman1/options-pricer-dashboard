import numpy as np


def price_asian_mc(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    asian_type: str = "fixed_strike",
    q: float = 0.0,
    n_paths: int = 200_000,
    n_steps: int = 252,
    seed: int = 42,
    n_sample_paths: int = 20,
) -> dict:
    """Monte Carlo Asian option pricing with antithetic variates.

    Simulates full paths step-by-step, tracking the arithmetic running
    average. Two payoff types:
      fixed_strike:    max(A - K, 0) for call, max(K - A, 0) for put
      floating_strike: max(ST - A, 0) for call, max(A - ST, 0) for put
    """
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    drift = (r - q - 0.5 * sigma**2) * dt
    vol = sigma * np.sqrt(dt)
    half = n_paths // 2

    S_current = np.full(n_paths, S, dtype=np.float64)
    running_sum = np.full(n_paths, S, dtype=np.float64)
    running_count = 1

    n_sample = min(n_sample_paths, n_paths)
    n_chart_points = min(50, n_steps)
    sample_interval = max(1, n_steps // n_chart_points)
    sample_prices = [[float(S)] for _ in range(n_sample)]
    sample_averages = [[float(S)] for _ in range(n_sample)]

    for step in range(n_steps):
        Z_half = rng.standard_normal(half)
        Z = np.concatenate([Z_half, -Z_half])
        S_current *= np.exp(drift + vol * Z)
        running_sum += S_current
        running_count += 1

        if (step + 1) % sample_interval == 0 or step == n_steps - 1:
            for i in range(n_sample):
                sample_prices[i].append(float(S_current[i]))
                sample_averages[i].append(float(running_sum[i] / running_count))

    A = running_sum / running_count
    ST = S_current

    if asian_type == "fixed_strike":
        if option_type == "call":
            payoffs = np.maximum(A - K, 0.0)
        else:
            payoffs = np.maximum(K - A, 0.0)
    else:
        if option_type == "call":
            payoffs = np.maximum(ST - A, 0.0)
        else:
            payoffs = np.maximum(A - ST, 0.0)

    disc = np.exp(-r * T)
    disc_payoffs = disc * payoffs

    mc_price = float(disc_payoffs.mean())
    se = float(disc_payoffs.std() / np.sqrt(n_paths))

    n_time_points = len(sample_prices[0])
    time_points = [round(i * T / (n_time_points - 1), 6) for i in range(n_time_points)]

    sample_paths = [
        {
            "prices": [round(p, 4) for p in sample_prices[i]],
            "averages": [round(a, 4) for a in sample_averages[i]],
        }
        for i in range(n_sample)
    ]

    return {
        "mc_price": round(mc_price, 6),
        "mc_std_error": round(se, 6),
        "mc_confidence_lower": round(mc_price - 1.96 * se, 6),
        "mc_confidence_upper": round(mc_price + 1.96 * se, 6),
        "average_price_mean": round(float(A.mean()), 4),
        "n_paths": n_paths,
        "n_steps": n_steps,
        "time_points": time_points,
        "sample_paths": sample_paths,
    }
