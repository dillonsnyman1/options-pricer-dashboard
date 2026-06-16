function result = monte_carlo(S, K, T, r, sigma, option_type, n_paths, seed)
% MONTE_CARLO  Price an option via Monte Carlo with antithetic variates.
%
%   result = monte_carlo(S, K, T, r, sigma, option_type)
%   result = monte_carlo(S, K, T, r, sigma, option_type, n_paths, seed)
%
%   Returns a struct with fields: price, std_error, n_paths.
%   Default n_paths = 100000, seed = 42.
%
%   Antithetic variates: pair each draw Z with -Z. For monotone payoffs,
%   f(Z) and f(-Z) are negatively correlated, so their average has lower
%   variance than two independent draws.
%
%   No toolboxes required.

if nargin < 7, n_paths = 100000; end
if nargin < 8, seed    = 42;     end

rng(seed);
half   = floor(n_paths / 2);
Z      = randn(half, 1);
Z_full = [Z; -Z];

disc    = exp(-r * T);
ST      = S * exp((r - 0.5*sigma^2)*T + sigma*sqrt(T)*Z_full);

if strcmp(option_type, 'call')
    pf = max(ST - K, 0);
else
    pf = max(K - ST, 0);
end

disc_pf   = disc * pf;
price     = mean(disc_pf);
std_error = std(disc_pf) / sqrt(n_paths);

result.price     = price;
result.std_error = std_error;
result.n_paths   = n_paths;
end
