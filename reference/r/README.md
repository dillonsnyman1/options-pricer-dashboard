# R reference

Base R implementation - no packages required. `pnorm` and `dnorm` are
built-in. `testthat` is only needed to run the tests.

## Usage

```r
source('options.R')

bs_price(S=100, K=100, T=1.0, r=0.05, sigma=0.20, option_type='call')
# [1] 10.4506

bs_greeks(100, 100, 1.0, 0.05, 0.20, 'call')
# $delta  0.6368
# $gamma  0.0188
# $vega   0.3752
# $theta -0.0176
# $rho    0.5323

implied_vol(market_price=10.45, S=100, K=100, T=1.0, r=0.05, option_type='call')
# [1] 0.2

monte_carlo(100, 100, 1.0, 0.05, 0.20, 'call', n_paths=100000L, seed=42L)
# $price     ~10.45
# $std_error ...
# $n_paths   100000

binomial_tree(100, 100, 1.0, 0.05, 0.20, 'call', n_steps=200L)
# $european_price         ~10.44
# $american_price         ~10.44
# $early_exercise_premium ~0.0

barrier_mc(100, 100, 1.0, 0.05, 0.20, 'call',
           barrier=85, barrier_type='down_and_out', n_paths=50000L)
# $price           ~10.0
# $std_error       ...
# $n_paths         50000
# $barrier_hit_pct ~8.5

asian_mc(100, 100, 1.0, 0.05, 0.20, 'call',
         asian_type='fixed_strike', n_paths=50000L)
# $price     ~5.8
# $std_error ...
# $n_paths   50000
```

## Tests

```r
install.packages('testthat')
Rscript test_options.R
```
