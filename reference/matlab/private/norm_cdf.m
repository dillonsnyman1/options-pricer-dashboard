function p = norm_cdf(x)
% Normal CDF using the built-in erf function (no Statistics Toolbox needed).
p = 0.5 * (1 + erf(x / sqrt(2)));
end
