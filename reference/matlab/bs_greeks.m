function g = bs_greeks(S, K, T, r, sigma, option_type)
% BS_GREEKS  Analytical Black-Scholes Greeks.
%
%   g = bs_greeks(S, K, T, r, sigma, option_type)
%
%   Returns a struct with fields: delta, gamma, vega, theta, rho.
%   Vega and Rho are scaled to a 1% move. Theta is per calendar day.
%
%   No toolboxes required.

d1   = (log(S/K) + (r + 0.5*sigma^2)*T) / (sigma*sqrt(T));
d2   = d1 - sigma*sqrt(T);
phi  = norm_pdf(d1);
sqT  = sqrt(T);
disc = exp(-r*T);

g.gamma = phi / (S * sigma * sqT);
g.vega  = S * phi * sqT / 100;   % per 1% move in vol

if strcmp(option_type, 'call')
    g.delta = norm_cdf(d1);
    g.theta = (-(S*phi*sigma/(2*sqT)) - r*K*disc*norm_cdf(d2))  / 365;
    g.rho   = K*T*disc*norm_cdf(d2) / 100;   % per 1% move in rate
else
    g.delta = norm_cdf(d1) - 1;
    g.theta = (-(S*phi*sigma/(2*sqT)) + r*K*disc*norm_cdf(-d2)) / 365;
    g.rho   = -K*T*disc*norm_cdf(-d2) / 100;
end
end
