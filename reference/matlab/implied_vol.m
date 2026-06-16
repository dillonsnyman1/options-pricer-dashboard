function sigma = implied_vol(market_price, S, K, T, r, option_type, tol, max_iter)
% IMPLIED_VOL  Newton-Raphson implied volatility solver.
%
%   sigma = implied_vol(market_price, S, K, T, r, option_type)
%   sigma = implied_vol(market_price, S, K, T, r, option_type, tol, max_iter)
%
%   Iterates sigma until BS(sigma) = market_price.
%   Default tol = 1e-7, max_iter = 100.
%
%   No toolboxes required.

if nargin < 7, tol      = 1e-7; end
if nargin < 8, max_iter = 100;  end

sigma = 0.2;
for i = 1:max_iter
    p        = bs_price(S, K, T, r, sigma, option_type);
    d1       = (log(S/K) + (r + 0.5*sigma^2)*T) / (sigma*sqrt(T));
    vega_raw = S * norm_pdf(d1) * sqrt(T);   % unscaled, used as derivative
    diff     = p - market_price;
    if abs(diff) < tol,        return; end
    if abs(vega_raw) < 1e-12,  break;  end
    sigma = sigma - diff / vega_raw;
    sigma = max(1e-6, min(sigma, 10.0));   % keep sigma in a sane range
end
end
