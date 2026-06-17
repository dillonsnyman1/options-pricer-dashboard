import numpy as np


def price_barrier_mc(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    barrier: float,
    barrier_type: str,
    q: float = 0.0,
    n_paths: int = 200_000,
    n_steps: int = 252,
    seed: int = 42,
    n_sample_paths: int = 20,
) -> dict:
    """Monte Carlo barrier option pricing with antithetic variates.

    Simulates full paths step-by-step, tracking running min/max to check
    barrier breaches efficiently. Returns MC price, confidence interval,
    barrier hit statistics, and a small number of sample paths for
    visualisation.
    """
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    drift = (r - q - 0.5 * sigma**2) * dt
    vol = sigma * np.sqrt(dt)
    half = n_paths // 2

    S_current = np.full(n_paths, S, dtype=np.float64)
    path_min = np.full(n_paths, S, dtype=np.float64)
    path_max = np.full(n_paths, S, dtype=np.float64)

    n_sample = min(n_sample_paths, n_paths)
    n_chart_points = min(50, n_steps)
    sample_interval = max(1, n_steps // n_chart_points)
    sample_data = [[float(S)] for _ in range(n_sample)]

    for step in range(n_steps):
        Z_half = rng.standard_normal(half)
        Z = np.concatenate([Z_half, -Z_half])
        S_current *= np.exp(drift + vol * Z)
        np.minimum(S_current, path_min, out=path_min)
        np.maximum(S_current, path_max, out=path_max)

        if (step + 1) % sample_interval == 0 or step == n_steps - 1:
            for i in range(n_sample):
                sample_data[i].append(float(S_current[i]))

    ST = S_current

    if barrier_type in ("down_and_out", "down_and_in"):
        barrier_hit = path_min <= barrier
    else:
        barrier_hit = path_max >= barrier

    if option_type == "call":
        payoffs = np.maximum(ST - K, 0.0)
    else:
        payoffs = np.maximum(K - ST, 0.0)

    if barrier_type in ("down_and_out", "up_and_out"):
        payoffs = payoffs * (~barrier_hit)
    else:
        payoffs = payoffs * barrier_hit

    disc = np.exp(-r * T)
    disc_payoffs = disc * payoffs

    mc_price = float(disc_payoffs.mean())
    se = float(disc_payoffs.std() / np.sqrt(n_paths))

    n_time_points = len(sample_data[0])
    time_points = [round(i * T / (n_time_points - 1), 6) for i in range(n_time_points)]

    sample_paths = [
        {"prices": [round(p, 4) for p in sample_data[i]], "barrier_hit": bool(barrier_hit[i])}
        for i in range(n_sample)
    ]

    return {
        "mc_price": round(mc_price, 6),
        "mc_std_error": round(se, 6),
        "mc_confidence_lower": round(mc_price - 1.96 * se, 6),
        "mc_confidence_upper": round(mc_price + 1.96 * se, 6),
        "barrier_hit_pct": round(float(barrier_hit.mean()) * 100, 2),
        "n_paths": n_paths,
        "n_monitoring_steps": n_steps,
        "time_points": time_points,
        "sample_paths": sample_paths,
    }
