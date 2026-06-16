import numpy as np


def price_with_convergence(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    path_counts: list[int],
    seed: int = 42,
) -> list[dict]:
    """Price the option at each path count in path_counts using antithetic variates.

    All draws share a single RNG seeded once, so each path_count level is a
    sub-sample of the full draw. That means convergence is smooth rather than
    jumping around between independent estimates.
    """
    max_paths = path_counts[-1]
    rng = np.random.default_rng(seed)

    half = max_paths // 2
    Z = rng.standard_normal(half)
    Z_full = np.concatenate([Z, -Z])  # antithetic pairs

    disc = np.exp(-r * T)
    ST = S * np.exp((r - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z_full)

    if option_type == "call":
        payoffs = np.maximum(ST - K, 0.0)
    else:
        payoffs = np.maximum(K - ST, 0.0)

    disc_payoffs = disc * payoffs

    results = []
    for n in path_counts:
        sub = disc_payoffs[:n]
        p = float(sub.mean())
        se = float(sub.std() / np.sqrt(n))
        results.append(
            {
                "n_paths": n,
                "price": p,
                "std_error": se,
                "confidence_lower": p - 1.96 * se,
                "confidence_upper": p + 1.96 * se,
            }
        )
    return results


def price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    n_paths: int = 200_000,
    seed: int = 42,
) -> dict:
    return price_with_convergence(S, K, T, r, sigma, option_type, [n_paths], seed)[0]
