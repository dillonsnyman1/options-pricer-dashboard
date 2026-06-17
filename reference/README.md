# Reference implementations

Independent, idiomatic implementations of the five core algorithms in four
languages, each free of external dependencies:

- [`python/`](python/) - pure Python (standard library only: `math`, `random`)
- [`r/`](r/) - base R only (`testthat` for tests)
- [`cpp/`](cpp/) - C++17, header-only (`options.hpp`), no external libraries
- [`matlab/`](matlab/) - no toolboxes required (`erf` replaces `normcdf`)

All four implement the same five core algorithms:

| Algorithm | Notes |
|-----------|-------|
| `bs_price` | Black-Scholes closed-form for European calls and puts |
| `bs_greeks` | Delta, Gamma, Vega (per 1% vol), Theta (per day), Rho (per 1% rate) |
| `implied_vol` | Newton-Raphson: iterate sigma until BS(sigma) = market price |
| `monte_carlo` | Risk-neutral simulation with antithetic variates (Z and -Z pairs) |
| `binomial_tree` | CRR backward induction, returns European and American prices in one pass |

The Python reference also includes `barrier_mc` (path-dependent barrier option
pricing via Monte Carlo with discrete monitoring) and `asian_mc` (arithmetic
average-price Asian option pricing). Adding these to R, C++, and MATLAB is
tracked as a follow-up.

Python, R, and C++ are validated against the fixtures in [`fixtures/`](fixtures/)
as part of automated CI. MATLAB uses the same fixtures but is validated manually
(see [`matlab/README.md`](matlab/README.md)) since that runtime is not available
in the CI environment.

## Fixtures

Five test cases covering a range of moneyness, expiry, and option type.
All expected values were generated from the backend Python implementation
(which uses scipy and numpy).

- `fixtures/test_cases.csv` - inputs: `S, K, T, r, sigma, option_type`
- `fixtures/expected_bs.csv` - expected BS price and all five Greeks
- `fixtures/expected_iv.csv` - expected implied vol (round-trip from BS price, so should recover input sigma)
- `fixtures/expected_binomial.csv` - expected European and American prices at 200 steps

Monte Carlo results are not in the fixtures because each language's PRNG
gives different draws for the same seed. MC tests instead verify the result
falls within 3 standard errors of the Black-Scholes price.

### Test case selection

| Case | S | K | T | r | sigma | Type | Purpose |
|------|---|---|---|---|-------|------|---------|
| 1 | 100 | 100 | 1.0 | 0.05 | 0.20 | call | ATM call, textbook reference |
| 2 | 100 | 100 | 1.0 | 0.05 | 0.20 | put  | Same params as case 1 (put-call parity check) |
| 3 | 100 | 110 | 0.5 | 0.05 | 0.25 | call | OTM call |
| 4 | 100 | 90  | 0.5 | 0.05 | 0.25 | put  | OTM put |
| 5 | 100 | 130 | 1.0 | 0.05 | 0.20 | put  | Deep ITM put - early exercise premium is large |

Case 5 is the interesting one for the binomial tree: the American price comes
out at 30.0 (intrinsic value) because immediate exercise dominates waiting.
The European price is ~25.3.
