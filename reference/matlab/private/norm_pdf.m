function p = norm_pdf(x)
% Standard normal PDF (no Statistics Toolbox needed).
p = exp(-0.5 * x.^2) / sqrt(2 * pi);
end
