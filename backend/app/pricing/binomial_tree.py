import numpy as np


def price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str,
    n_steps: int = 500,
    q: float = 0.0,
    discrete_dividends=None,
) -> dict:
    """CRR (Cox-Ross-Rubinstein) binomial tree.

    Returns both European and American prices so the early-exercise premium is
    visible without a second API call. Discrete dividends use the escrowed approach:
    S_adj = S - PV(dividends). For American early-exercise checks, the actual stock
    price at each node adds back the PV of dividends still outstanding from that point.
    """
    divs = [(t, D) for t, D in (discrete_dividends or []) if 0 < t <= T]
    S_adj = S - sum(D * np.exp(-r * t) for t, D in divs)

    dt = T / n_steps
    u = float(np.exp(sigma * np.sqrt(dt)))
    d = 1.0 / u
    p = (np.exp((r - q) * dt) - d) / (u - d)
    disc = np.exp(-r * dt)

    j = np.arange(n_steps + 1)
    ST = S_adj * u ** (n_steps - j) * d**j

    if option_type == "call":
        payoff_fn = lambda s: np.maximum(s - K, 0.0)
    else:
        payoff_fn = lambda s: np.maximum(K - s, 0.0)

    # European: no early-exercise check during backward induction
    V_eur = payoff_fn(ST).copy()
    for _ in range(n_steps):
        V_eur = disc * (p * V_eur[:-1] + (1 - p) * V_eur[1:])

    # Pre-compute PV of future dividends at each step for the American intrinsic check.
    # At step i (time i*dt), actual stock price = S_adj_node + PV of dividends still outstanding.
    step_future_pv = np.zeros(n_steps)
    for i in range(n_steps):
        t_node = i * dt
        step_future_pv[i] = sum(D * np.exp(-r * (t_div - t_node)) for t_div, D in divs if t_div > t_node)

    # American: check against intrinsic value at every node
    V_am = payoff_fn(ST).copy()
    for i in range(n_steps - 1, -1, -1):
        V_am = disc * (p * V_am[:-1] + (1 - p) * V_am[1:])
        j_nodes = np.arange(i + 1)
        ST_nodes = S_adj * u ** (i - j_nodes) * d**j_nodes + step_future_pv[i]
        V_am = np.maximum(V_am, payoff_fn(ST_nodes))

    european_price = float(V_eur[0])
    american_price = float(V_am[0])

    return {
        "european_price": european_price,
        "american_price": american_price,
        "n_steps": n_steps,
        "early_exercise_premium": round(american_price - european_price, 8),
    }
