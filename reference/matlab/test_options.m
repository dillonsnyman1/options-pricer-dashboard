% test_options.m
%
% Manual test script for the MATLAB options reference implementation.
% Run from the matlab/ directory. Prints PASS/FAIL for each check.
%
% Fixtures are read from ../fixtures/. All expected values were generated
% from the Python reference implementation.

FIXTURES = fullfile(fileparts(mfilename('fullpath')), '..', 'fixtures');

cases   = readtable(fullfile(FIXTURES, 'test_cases.csv'), 'TextType', 'string');
exp_bs  = readtable(fullfile(FIXTURES, 'expected_bs.csv'));
exp_iv  = readtable(fullfile(FIXTURES, 'expected_iv.csv'));
exp_bin = readtable(fullfile(FIXTURES, 'expected_binomial.csv'));

passed = 0;
failed = 0;

function check(cond, label)
    if cond
        fprintf('PASS  %s\n', label);
        passed = passed + 1;
    else
        fprintf('FAIL  %s\n', label);
        failed = failed + 1;
    end
end

% We use a nested approach since MATLAB does not have closures easily.
% Instead, accumulate results and print summary at the end.

results = {};

function results = chk(results, cond, label)
    results{end+1} = struct('ok', cond, 'label', label);
end

% ---- Black-Scholes price ---------------------------------------------------
for i = 1:height(cases)
    row  = cases(i,:);
    cid  = row.case_id;
    got  = bs_price(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type));
    exp  = exp_bs.price(exp_bs.case_id == cid);
    results = chk(results, abs(got - exp) < 1e-4, sprintf('bs_price case %d', cid));
end

% Put-call parity: C - P = S - K*exp(-rT)
row    = cases(cases.case_id == 1, :);
call_p = bs_price(row.S, row.K, row.T, row.r, row.sigma, 'call');
put_p  = bs_price(row.S, row.K, row.T, row.r, row.sigma, 'put');
parity = row.S - row.K * exp(-row.r * row.T);
results = chk(results, abs((call_p - put_p) - parity) < 1e-8, 'put-call parity');

% ---- Greeks ----------------------------------------------------------------
for i = 1:height(cases)
    row  = cases(i,:);
    cid  = row.case_id;
    g    = bs_greeks(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type));
    ref  = exp_bs(exp_bs.case_id == cid, :);
    for fn = {'delta','gamma','vega','theta','rho'}
        fname = fn{1};
        results = chk(results, abs(g.(fname) - ref.(fname)) < 1e-4, ...
                      sprintf('greek %s case %d', fname, cid));
    end
    results = chk(results, g.gamma > 0, sprintf('gamma positive case %d', cid));
    results = chk(results, g.vega  > 0, sprintf('vega positive case %d', cid));
end

% ---- Implied vol -----------------------------------------------------------
for i = 1:height(cases)
    row = cases(i,:);
    cid = row.case_id;
    mkt = bs_price(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type));
    iv  = implied_vol(mkt, row.S, row.K, row.T, row.r, char(row.option_type));
    exp = exp_iv.implied_vol(exp_iv.case_id == cid);
    results = chk(results, abs(iv - exp) < 1e-4, sprintf('implied_vol case %d', cid));
end

% ---- Binomial tree ---------------------------------------------------------
for i = 1:height(cases)
    row = cases(i,:);
    cid = row.case_id;
    res = binomial_tree(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type), 200);
    ref = exp_bin(exp_bin.case_id == cid, :);
    results = chk(results, abs(res.european_price - ref.european_price) < 0.05, ...
                  sprintf('binomial European case %d', cid));
    results = chk(results, abs(res.american_price - ref.american_price) < 0.05, ...
                  sprintf('binomial American case %d', cid));
    results = chk(results, res.american_price >= res.european_price - 1e-9, ...
                  sprintf('Am >= Eur case %d', cid));
end

% Deep ITM put early exercise
res_deep = binomial_tree(100, 130, 1.0, 0.05, 0.20, 'put', 200);
results = chk(results, res_deep.american_price >= 29.9, 'deep ITM put american >= 29.9');
results = chk(results, res_deep.early_exercise_premium > 4.0, 'deep ITM put premium > 4');

% Call no early exercise
res_call = binomial_tree(100, 100, 1.0, 0.05, 0.20, 'call', 200);
results = chk(results, abs(res_call.early_exercise_premium) < 1e-6, 'call no early exercise');

% ---- Monte Carlo -----------------------------------------------------------
for i = 1:height(cases)
    row = cases(i,:);
    ref = bs_price(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type));
    mc  = monte_carlo(row.S, row.K, row.T, row.r, row.sigma, char(row.option_type), 100000, 42);
    results = chk(results, abs(mc.price - ref) < 3.0 * mc.std_error, ...
                  sprintf('MC within 3 SEs case %d', row.case_id));
end

% ---- Summary ---------------------------------------------------------------
total  = length(results);
npass  = sum(cellfun(@(r) r.ok, results));
nfail  = total - npass;

fprintf('\n');
for i = 1:total
    r = results{i};
    if r.ok
        fprintf('PASS  %s\n', r.label);
    else
        fprintf('FAIL  %s\n', r.label);
    end
end
fprintf('\n%d/%d tests passed', npass, total);
if nfail > 0
    fprintf(' (%d failed)', nfail);
end
fprintf('\n');
