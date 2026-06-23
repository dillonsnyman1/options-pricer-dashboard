# Extensions & Improvements

Tracked items from the known limitations and possible extensions section of the README.
Ordered roughly by effort.

---

## In progress

- [ ] **Reference: exotic pricers in R, C++, MATLAB** — Python reference has barrier_mc and asian_mc; port to the other three languages and add fixture validation.
  - [x] Python
  - [x] R
  - [x] C++
  - [ ] MATLAB

---

## Backlog

### Easy

- [ ] **Reference implementation: Julia** — Standalone implementation of all five algorithms in `reference/julia/`, validated against the shared fixtures in `reference/fixtures/`. No changes to the main app.

- [ ] **Reference implementation: Java** — Same as Julia but Java/Kotlin. Relevant for bank risk systems context.

### Medium

- [ ] **Portfolio / book mode** — New API endpoint accepting a list of positions; aggregate net delta, gamma, vega, and combined P&L heatmap. Requires a position builder UI in the frontend.


- [ ] **Real market data** — Connect to a live source (CBOE options chain, Yahoo Finance spot) and run the IV solver on real market prices to display the observed smile instead of the synthetic one.

### Hard

- [ ] **American options via MC (Longstaff-Schwartz)** — Least-squares regression at each time step to estimate the continuation value and decide on early exercise. Significantly more involved than the binomial approach.

- [ ] **Heston stochastic volatility model** — Mean-reverting vol correlated with spot; semi-analytical price via characteristic function / Fourier inversion. Endogenously generates the vol smile rather than fitting it parametrically.

- [ ] **SVI / SABR vol surface calibration** — Replace the toy `σ_ATM + skew·m + curvature·m²` parametrisation with a properly calibrated, arbitrage-free surface fitted to market quotes.

---

## Done

- [x] **Continuous dividend yield** — Added `q` param (Merton model: `r → r - q`) to all three pricers, all request models, and the frontend form. 29/29 tests passing.
- [x] **Exotic options: barriers** — MC path simulation with discrete monitoring (default 252 steps). Four barrier types (up/down × in/out). Sample path visualisation with barrier hit colouring. Vanilla BS price shown for comparison.
- [x] **Exotic options: Asians** — MC with arithmetic running average. Fixed-strike (payoff on average vs K) and floating-strike (payoff on terminal vs average). Sample paths show spot and running average lines. Python reference included.
- [x] **Discrete dividends** — Escrowed-dividend approach (S_adj = S − Σ PV(D_i)) in all three pricers. Binomial tree adds back PV of future dividends at each node for the American intrinsic check. Frontend has add/remove dividend UI. Note: the escrowed and forward-price adjustment methods are mathematically equivalent. 33/33 tests passing.
