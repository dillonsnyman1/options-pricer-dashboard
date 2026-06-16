# C++ reference

Header-only, C++17, no external dependencies. Include `options.hpp` and
you get all five algorithms in the `options` namespace.

## Usage

```cpp
#include "options.hpp"

double price = options::bs_price(100, 100, 1.0, 0.05, 0.20, "call");
// 10.4506

options::Greeks g = options::bs_greeks(100, 100, 1.0, 0.05, 0.20, "call");
// g.delta = 0.6368, g.gamma = 0.0188, g.vega = 0.3752, ...

double iv = options::implied_vol(10.45, 100, 100, 1.0, 0.05, "call");
// ~0.20

options::MCResult mc = options::monte_carlo(100, 100, 1.0, 0.05, 0.20, "call", 100000, 42);
// mc.price ~10.45, mc.std_error ..., mc.n_paths 100000

options::BinomialResult tree = options::binomial_tree(100, 100, 1.0, 0.05, 0.20, "call", 200);
// tree.european_price ~10.44, tree.american_price ~10.44
```

## Build and test

```bash
cmake -B build
cmake --build build
cd build && ctest --output-on-failure
```

Or compile directly:

```bash
g++ -std=c++17 -O2 -o test_options test_options.cpp && ./test_options
```

The test binary reads fixture files from `../fixtures/` relative to where
it is run, so run it from the `cpp/` directory.
