# Options Pricer & Greeks Dashboard

[![CI/CD](https://github.com/dillonsnyman1/options-pricer-dashboard/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/dillonsnyman1/options-pricer-dashboard/actions/workflows/ci-cd.yml)

A full-stack demo that prices European and American options using three methods and
shows the full Greeks, implied volatility smile, Monte Carlo convergence, and a
P&L scenario heatmap.

- **Backend**: Python + FastAPI for the pricing engines
- **Frontend**: React + Vite + TypeScript dashboard (pricer, Greeks, IV smile, Monte Carlo, P&L heatmap)

> **Live demo**: [d10ls11pbsolux.cloudfront.net](https://d10ls11pbsolux.cloudfront.net) - try adjusting the option parameters, switching pricing methods, or exploring the Greeks sensitivity and IV smile tabs.
>
> The backend is fully stateless: all pricing is done in-request with no database or storage of any kind.

> **Disclaimer**: Simplified demo built for portfolio purposes. Not a production pricing
> library and should not be used for live trading. All defaults are synthetic.

---

## Background

Options give the buyer the right, but not the obligation, to buy (call) or sell (put)
an underlying asset at a fixed price (the strike) on or before a specified date. That
right has a price - the option premium - and working out what it should be is the core
problem in derivatives pricing.

The challenge is that the fair price depends on five inputs: spot price, strike, time to
expiry, interest rate, and expected volatility. The first four are observable. Volatility
is not - you're pricing something that depends critically on how much the underlying will
move before expiry, and nobody knows that in advance. Different models make different
assumptions about the return distribution, and those differences matter.

Three approaches are compared here:

- **Black-Scholes** assumes constant, known vol and gives an exact closed-form answer for European options. Fast and analytically clean, but the constant-vol assumption is demonstrably wrong in practice.
- **Monte Carlo** simulates thousands of possible price paths and averages the payoffs. Slower, but it generalises to payoffs and dynamics that have no analytical solution (path-dependent options, stochastic vol, jumps).
- **Binomial tree** discretises time into a recombining lattice. Naturally handles early exercise, making it the right tool for American options where no closed-form exists.

The Greeks show how each of the five inputs affects the option price. In practice, traders
manage these sensitivities continuously rather than the price itself - delta hedging to
stay directionally neutral, vega exposure to manage vol risk, and so on.

The IV smile tab illustrates one of the most important empirical facts in options markets:
if Black-Scholes were correct, implied vol would be flat across strikes. It isn't. The
vol smile (or skew) is the market pricing in return distributions with fatter tails and
more skew than the lognormal model assumes.

---

## Methodology

Three methods run on each request so you can compare the outputs directly.
Inputs: `S` (spot), `K` (strike), `T` (time to expiry in years), `r` (risk-free rate),
`sigma` (annualised vol), `option_type` (call or put).

### 1. Black-Scholes (analytical)

Black-Scholes assumes lognormal returns, constant volatility, continuous trading, and
no transaction costs. This implementation extends vanilla BS with a continuous dividend
yield via the Merton (1973) adjustment (r → r − q), which is why q appears in the
formulas below. Under those assumptions it gives a closed-form price and exact Greeks,
which is why it became the market standard despite everyone knowing the assumptions are
wrong in practice.

```
d1 = [ln(S/K) + (r - q + sigma^2/2)*T] / (sigma*sqrt(T))
d2 = d1 - sigma*sqrt(T)

Call = S*exp(-q*T)*N(d1) - K*exp(-r*T)*N(d2)
Put  = K*exp(-r*T)*N(-d2) - S*exp(-q*T)*N(-d1)
```

The main limitation is the constant-vol assumption. If BS were correct, implied volatility
would be flat across strikes. The vol smile — the fact that it isn't — reflects return
distributions with fatter tails and more skew than lognormal assumes. Practitioners still
use BS extensively, but they quote options in implied vol terms and track the smile to
measure where the model is wrong.

#### Greeks

All computed analytically from the same d1/d2. Vega and Rho are scaled to a 1% move
so the numbers are in the same ballpark as the price.

| Greek  | Formula | Scaling |
|--------|---------|---------|
| Delta  | exp(-q*T)*N(d1) for call, exp(-q*T)*(N(d1)-1) for put | n/a |
| Gamma  | exp(-q*T)*N'(d1) / (S*sigma*sqrt(T)) | n/a |
| Vega   | S*exp(-q*T)*N'(d1)*sqrt(T) | per 1% move in sigma |
| Theta  | -[S*N'(d1)*sigma/(2*sqrt(T)) +/- r*K*exp(-rT)*N(+/-d2)] | per calendar day |
| Rho    | +/-K*T*exp(-rT)*N(+/-d2) | per 1% move in r |

### 2. Monte Carlo with antithetic variates

Monte Carlo is not competitive with Black-Scholes for plain vanilla options - it's much
slower and noisier. The reason to include it here is that MC generalises easily to things
BS can't handle: path-dependent payoffs (barriers, Asians), stochastic volatility models
(Heston, SABR), jumps, and complex multi-asset baskets. The plain-vanilla case is a good
baseline to understand the method before extending it.

```
Z ~ N(0,1)  (half the paths, rest are -Z)
ST = S * exp[(r - q - sigma^2/2)*T + sigma*sqrt(T)*Z]
Price = exp(-r*T) * E[max(ST - K, 0)]
```

Antithetic variates pair each draw Z with -Z. Because call payoffs are monotone in the
terminal stock price, f(Z) and f(-Z) are negatively correlated, so their average has lower
variance than using two independent draws. This roughly halves the standard error for a
given path count, or equivalently gives the same accuracy with a quarter of the paths.

The convergence chart shows the 95% CI tightening as path count grows and where it
lands relative to the Black-Scholes price. MC converges at O(1/sqrt(N)), which is why
200,000 paths are needed to get within a few cents of the analytical answer.

### 3. CRR Binomial Tree

The main reason to use a binomial tree instead of Black-Scholes is American options.
Because you can exercise early, there's no closed-form price - you have to check at
every point in time whether early exercise is worth more than continuation, which is
exactly what backward induction on a tree does.

```
u = exp(sigma*sqrt(dt)),   d = 1/u,   p = (exp((r-q)*dt) - d) / (u - d)
```

The 500-step CRR tree runs two backward inductions in a single pass: one with no
early-exercise check (European) and one that takes the max of continuation value and
intrinsic at each node (American). The difference between the two is the early exercise
premium - for a call on a non-dividend-paying stock this should be near zero, while
for a deep ITM put it can be substantial.

As step count increases, the European binomial price converges to Black-Scholes, which
is a useful sanity check on the implementation.

### 4. Implied Volatility and the Vol Smile

Newton-Raphson solver: given a market price, iterates sigma until BS(sigma) = market_price.
Convergence is fast (typically < 10 iterations) because vega is smooth and always positive.

```
sigma(K) = sigma_ATM + skew*ln(K/S) + curvature*ln(K/S)^2
```

This parametric surface is a simplified stand-in for a real vol surface. In equity markets
the skew is typically negative (put skew): OTM puts trade at a higher implied vol than
OTM calls because there's more demand for downside protection. The curvature parameter
adds a symmetric "smile" on top of the skew, reflecting fat-tail risk in both directions.

The IV smile tab generates prices from this surface then backs out the IVs via the
Newton-Raphson solver, so what you see is the round-trip: parametric vol -> price -> implied vol.

---

## Known limitations and possible extensions

> Tracked in [EXTENSIONS.md](EXTENSIONS.md).

### Model limitations

The current implementation makes several simplifying assumptions that would not
hold in a production pricing library:

- **Constant volatility.** Black-Scholes assumes a single sigma that applies
  everywhere. In reality vol varies by strike and expiry - the vol surface. The
  parametric smile here is a toy stand-in; a real system would calibrate to
  actual market quotes and enforce no-arbitrage constraints across the surface.

- **~~Dividends~~ (implemented).** Continuous dividend yield `q` via the Merton
  adjustment, and discrete dividends via the escrowed approach (subtract PV of each
  dividend from spot before pricing). Both methods are available in all three pricers.
  The escrowed and forward-price adjustment approaches are mathematically equivalent.

- **No term structure.** Each pricing request takes a single expiry. A real vol
  surface has a term structure: different implied vol levels and smile shapes at
  each maturity, which must be interpolated consistently.

- **European MC only.** The Monte Carlo engine prices European payoffs. American
  options via MC require Longstaff-Schwartz least-squares regression to estimate
  the continuation value at each time step - significantly more involved than the
  binomial tree approach used here.

### Natural next steps

**Stochastic volatility (Heston model)**
The most widely used extension beyond Black-Scholes. Heston makes vol itself
mean-reverting and correlated with the spot, which endogenously generates the
vol smile rather than fitting it parametrically. It has a semi-analytical
characteristic function solution (Fourier inversion) and is the standard
starting point for equity vol desks.

**SVI / SABR vol surface calibration**
Stochastic Volatility Inspired (SVI) is the industry-standard parametric form
for fitting a single-maturity smile to market quotes in a way that avoids
static arbitrage. SABR is more common in rates and FX. Either would replace the
toy `sigma_ATM + skew*m + curvature*m^2` used here with a properly calibrated
surface.

**Exotic options (barriers, Asians)**
Knock-in / knock-out barriers and Asian (average-price) options are
path-dependent, so Black-Scholes has no simple closed form. They are a natural
Monte Carlo extension: the same simulation engine handles them by recording the
path, not just the terminal value. Barriers also have partial analytical
solutions under GBM that serve as useful checks.

**Real market data**
Connecting to a live data source (e.g. CBOE for options chains, Yahoo Finance
for spot) would let the IV solver run the other direction: given real market
prices, back out the full observed smile instead of generating a synthetic one.

**Portfolio / book mode**
The current UI prices one option at a time. A book view would aggregate a
position of multiple options and show net delta, gamma, vega, and the combined
P&L heatmap - which is closer to how risk is actually managed on a desk.

**Reference implementations**
Julia and Java would be useful additions to the `reference/` folder. Julia is
increasingly common in quant research (fast, expressive, good numerical
libraries). Java / Kotlin is still the dominant language in bank risk systems
and trade capture.

---

## Running locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Tests**
```bash
cd backend
pytest
```

---

## Reference implementations

[`reference/`](reference/) contains standalone, dependency-free implementations
of all five algorithms in Python, R, C++, and MATLAB - each idiomatic to its
language. The same fixture files in [`reference/fixtures/`](reference/fixtures/)
are used to validate all four. See [`reference/README.md`](reference/README.md)
for details.

---

## Infrastructure

FastAPI on AWS Lambda (arm64) behind API Gateway, with the frontend on S3 + CloudFront.
Deployed via Terraform on every push to `main`. See `infra/bootstrap/` for the
one-time setup needed before the first deploy.
