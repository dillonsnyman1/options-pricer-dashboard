# Extensions & Improvements

Tracked items from the known limitations and possible extensions section of the README.
Ordered roughly by effort.

---

## In progress

- [ ] **Continuous dividend yield** — Add `q` param to all three pricers (`r → r - q` in BS, binomial, MC drift). Update request model and frontend input. ~50 lines across 5–6 files.

---

## Backlog

### Easy

- [ ] **Reference implementation: Julia** — Standalone implementation of all five algorithms in `reference/julia/`, validated against the shared fixtures in `reference/fixtures/`. No changes to the main app.

- [ ] **Reference implementation: Java** — Same as Julia but Java/Kotlin. Relevant for bank risk systems context.

### Medium

- [ ] **Portfolio / book mode** — New API endpoint accepting a list of positions; aggregate net delta, gamma, vega, and combined P&L heatmap. Requires a position builder UI in the frontend.

- [ ] **Exotic options: barriers** — Extend the MC engine to record path extrema and apply knock-in/knock-out logic. Add partial analytical solutions under GBM as a cross-check.

- [ ] **Exotic options: Asians** — Path-dependent average-price payoff in MC. Records running average along each path instead of just the terminal value.

- [ ] **Real market data** — Connect to a live source (CBOE options chain, Yahoo Finance spot) and run the IV solver on real market prices to display the observed smile instead of the synthetic one.

### Hard

- [ ] **American options via MC (Longstaff-Schwartz)** — Least-squares regression at each time step to estimate the continuation value and decide on early exercise. Significantly more involved than the binomial approach.

- [ ] **Heston stochastic volatility model** — Mean-reverting vol correlated with spot; semi-analytical price via characteristic function / Fourier inversion. Endogenously generates the vol smile rather than fitting it parametrically.

- [ ] **SVI / SABR vol surface calibration** — Replace the toy `σ_ATM + skew·m + curvature·m²` parametrisation with a properly calibrated, arbitrage-free surface fitted to market quotes.

---

## Done

_Nothing completed yet._
