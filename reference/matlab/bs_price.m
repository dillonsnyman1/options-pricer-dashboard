function price = bs_price(S, K, T, r, sigma, option_type)
% BS_PRICE  Black-Scholes price for a European call or put.
%
%   price = bs_price(S, K, T, r, sigma, option_type)
%
%   S           - spot price
%   K           - strike price
%   T           - time to expiry in years
%   r           - continuous risk-free rate (e.g. 0.05 for 5%)
%   sigma       - annualised volatility (e.g. 0.20 for 20%)
%   option_type - 'call' or 'put'
%
%   No toolboxes required.

d1   = (log(S/K) + (r + 0.5*sigma^2)*T) / (sigma*sqrt(T));
d2   = d1 - sigma*sqrt(T);
disc = exp(-r*T);

if strcmp(option_type, 'call')
    price = S * norm_cdf(d1) - K * disc * norm_cdf(d2);
else
    price = K * disc * norm_cdf(-d2) - S * norm_cdf(-d1);
end
end
