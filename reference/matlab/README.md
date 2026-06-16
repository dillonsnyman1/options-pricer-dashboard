# MATLAB reference

No toolboxes required. `normcdf` and `normpdf` would need the Statistics
Toolbox, so these are replaced with `private/norm_cdf.m` and `private/norm_pdf.m`
which use MATLAB's built-in `erf` function.

## Usage

```matlab
% Run from the matlab/ directory so MATLAB can find the private helpers.

price = bs_price(100, 100, 1.0, 0.05, 0.20, 'call')
% 10.4506

g = bs_greeks(100, 100, 1.0, 0.05, 0.20, 'call')
% g.delta = 0.6368, g.gamma = 0.0188, g.vega = 0.3752, ...

iv = implied_vol(10.45, 100, 100, 1.0, 0.05, 'call')
% 0.2

mc = monte_carlo(100, 100, 1.0, 0.05, 0.20, 'call', 100000, 42)
% mc.price ~10.45

tree = binomial_tree(100, 100, 1.0, 0.05, 0.20, 'call', 200)
% tree.european_price ~10.44, tree.american_price ~10.44
```

## Tests

MATLAB is not available in CI so tests are run manually:

```matlab
cd matlab
run('test_options.m')
```

The script reads fixtures from `../fixtures/` and prints PASS/FAIL per check
with a summary at the end.
