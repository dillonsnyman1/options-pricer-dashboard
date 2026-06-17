# Python reference

Pure Python implementation - no external dependencies beyond the standard library
(`math` for the normal CDF via `erf`, `random` for Monte Carlo draws).

## Usage

```python
from options import bs_price, bs_greeks, implied_vol, monte_carlo, binomial_tree, barrier_mc, asian_mc

price = bs_price(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type='call')
# 10.4506

greeks = bs_greeks(100, 100, 1.0, 0.05, 0.20, 'call')
# {'delta': 0.6368, 'gamma': 0.0188, 'vega': 0.3752, 'theta': -0.0176, 'rho': 0.5323}

iv = implied_vol(market_price=10.45, S=100, K=100, T=1.0, r=0.05, option_type='call')
# ~0.20

mc = monte_carlo(100, 100, 1.0, 0.05, 0.20, 'call', n_paths=100_000, seed=42)
# {'price': ~10.45, 'std_error': ..., 'n_paths': 100000}

tree = binomial_tree(100, 100, 1.0, 0.05, 0.20, 'call', n_steps=200)
# {'european_price': ~10.44, 'american_price': ~10.44, 'early_exercise_premium': ~0.0}

b = barrier_mc(100, 100, 1.0, 0.05, 0.20, 'call', barrier=85,
               barrier_type='down_and_out', n_paths=100_000, seed=42)
# {'price': ~9.8, 'std_error': ..., 'n_paths': 100000, 'barrier_hit_pct': ...}

a = asian_mc(100, 100, 1.0, 0.05, 0.20, 'call',
             asian_type='fixed_strike', n_paths=100_000, seed=42)
# {'price': ~5.8, 'std_error': ..., 'n_paths': 100000}
```

## Tests

```bash
pip install pytest
pytest test_options.py -v
```

The Monte Carlo and binomial tests use 100k paths and 200 steps respectively.
Expect the test suite to take a few seconds on first run.
