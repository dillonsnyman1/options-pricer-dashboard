function result = binomial_tree(S, K, T, r, sigma, option_type, n_steps)
% BINOMIAL_TREE  CRR binomial tree, returning European and American prices.
%
%   result = binomial_tree(S, K, T, r, sigma, option_type)
%   result = binomial_tree(S, K, T, r, sigma, option_type, n_steps)
%
%   Returns a struct with fields:
%     european_price         - no early-exercise check
%     american_price         - max(continuation, intrinsic) at every node
%     early_exercise_premium - american_price - european_price
%
%   The premium is most significant for deep ITM puts. For calls on a
%   non-dividend-paying stock it is always effectively zero.
%   Default n_steps = 200.
%
%   No toolboxes required.

if nargin < 7, n_steps = 200; end

dt   = T / n_steps;
u    = exp(sigma * sqrt(dt));
d    = 1 / u;
p    = (exp(r*dt) - d) / (u - d);
disc = exp(-r*dt);

j  = (0:n_steps)';
ST = S * u.^(n_steps - j) .* d.^j;

if strcmp(option_type, 'call')
    payoff_fn = @(s) max(s - K, 0);
else
    payoff_fn = @(s) max(K - s, 0);
end

V_eur = payoff_fn(ST);
V_am  = payoff_fn(ST);

% European: straightforward backward induction, no early-exercise check
for step = 1:n_steps
    V_eur = disc * (p * V_eur(1:end-1) + (1-p) * V_eur(2:end));
end

% American: same induction, but take max of continuation and intrinsic
for i = n_steps-1:-1:0
    V_am     = disc * (p * V_am(1:end-1) + (1-p) * V_am(2:end));
    j_nodes  = (0:i)';
    ST_nodes = S * u.^(i - j_nodes) .* d.^j_nodes;
    V_am     = max(V_am, payoff_fn(ST_nodes));
end

eur = V_eur(1);
am  = V_am(1);

result.european_price         = eur;
result.american_price         = am;
result.early_exercise_premium = am - eur;
end
