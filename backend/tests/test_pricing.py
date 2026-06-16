import numpy as np
import pytest

from app.pricing import binomial_tree, black_scholes, monte_carlo

# Standard ATM parameters used throughout: S=100, K=100, T=1yr, r=5%, σ=20%
# Textbook BS call price ≈ 10.4506
S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.2


class TestBlackScholes:
    def test_call_price_known_value(self):
        p = black_scholes.price(S, K, T, r, sigma, "call")
        assert abs(p - 10.4506) < 0.001

    def test_put_call_parity(self):
        c = black_scholes.price(S, K, T, r, sigma, "call")
        p = black_scholes.price(S, K, T, r, sigma, "put")
        parity = S - K * np.exp(-r * T)
        assert abs((c - p) - parity) < 1e-6

    def test_deep_itm_call_delta_near_one(self):
        g = black_scholes.greeks(S, K * 0.5, T, r, sigma, "call")
        assert g["delta"] > 0.95

    def test_delta_call_in_zero_one(self):
        g = black_scholes.greeks(S, K, T, r, sigma, "call")
        assert 0.0 < g["delta"] < 1.0

    def test_delta_put_negative(self):
        g = black_scholes.greeks(S, K, T, r, sigma, "put")
        assert -1.0 < g["delta"] < 0.0

    @pytest.mark.parametrize("opt", ["call", "put"])
    def test_gamma_positive(self, opt):
        g = black_scholes.greeks(S, K, T, r, sigma, opt)
        assert g["gamma"] > 0.0

    @pytest.mark.parametrize("opt", ["call", "put"])
    def test_vega_positive(self, opt):
        g = black_scholes.greeks(S, K, T, r, sigma, opt)
        assert g["vega"] > 0.0

    @pytest.mark.parametrize("opt", ["call", "put"])
    def test_theta_negative_for_long_option(self, opt):
        g = black_scholes.greeks(S, K, T, r, sigma, opt)
        assert g["theta"] < 0.0

    def test_gamma_same_for_call_and_put(self):
        gc = black_scholes.greeks(S, K, T, r, sigma, "call")
        gp = black_scholes.greeks(S, K, T, r, sigma, "put")
        assert abs(gc["gamma"] - gp["gamma"]) < 1e-10

    def test_vega_same_for_call_and_put(self):
        gc = black_scholes.greeks(S, K, T, r, sigma, "call")
        gp = black_scholes.greeks(S, K, T, r, sigma, "put")
        assert abs(gc["vega"] - gp["vega"]) < 1e-10

    @pytest.mark.parametrize("vol", [0.10, 0.20, 0.35, 0.50])
    def test_implied_vol_roundtrip(self, vol):
        p = black_scholes.price(S, K, T, r, vol, "call")
        iv = black_scholes.implied_vol(p, S, K, T, r, "call")
        assert abs(iv - vol) < 1e-5

    def test_dividend_lowers_call_price(self):
        c_no_div = black_scholes.price(S, K, T, r, sigma, "call", q=0.0)
        c_div = black_scholes.price(S, K, T, r, sigma, "call", q=0.03)
        assert c_div < c_no_div

    def test_dividend_raises_put_price(self):
        p_no_div = black_scholes.price(S, K, T, r, sigma, "put", q=0.0)
        p_div = black_scholes.price(S, K, T, r, sigma, "put", q=0.03)
        assert p_div > p_no_div

    def test_put_call_parity_with_dividends(self):
        q = 0.03
        c = black_scholes.price(S, K, T, r, sigma, "call", q=q)
        p = black_scholes.price(S, K, T, r, sigma, "put", q=q)
        parity = S * np.exp(-q * T) - K * np.exp(-r * T)
        assert abs((c - p) - parity) < 1e-6

    def test_implied_vol_roundtrip_with_dividends(self):
        q = 0.03
        p = black_scholes.price(S, K, T, r, sigma, "call", q=q)
        iv = black_scholes.implied_vol(p, S, K, T, r, "call", q=q)
        assert abs(iv - sigma) < 1e-5


class TestBinomialTree:
    def test_european_call_converges_to_bs(self):
        bs_p = black_scholes.price(S, K, T, r, sigma, "call")
        result = binomial_tree.price(S, K, T, r, sigma, "call", n_steps=1_000)
        assert abs(result["european_price"] - bs_p) < 0.05

    def test_american_put_ge_european_put(self):
        result = binomial_tree.price(S, K, T, r, sigma, "put", n_steps=500)
        assert result["american_price"] >= result["european_price"] - 1e-8

    def test_early_exercise_premium_nonnegative(self):
        result = binomial_tree.price(S, K, T, r, sigma, "put", n_steps=500)
        assert result["early_exercise_premium"] >= -1e-8

    def test_result_keys(self):
        result = binomial_tree.price(S, K, T, r, sigma, "call")
        assert {"european_price", "american_price", "n_steps", "early_exercise_premium"} <= result.keys()


class TestMonteCarlo:
    def test_price_close_to_bs(self):
        bs_p = black_scholes.price(S, K, T, r, sigma, "call")
        mc = monte_carlo.price(S, K, T, r, sigma, "call", n_paths=200_000)
        assert abs(mc["price"] - bs_p) < 0.10

    def test_convergence_series_length(self):
        steps = [1_000, 10_000, 100_000]
        results = monte_carlo.price_with_convergence(S, K, T, r, sigma, "call", steps)
        assert len(results) == len(steps)

    def test_std_error_decreases_with_more_paths(self):
        steps = [1_000, 10_000, 100_000]
        results = monte_carlo.price_with_convergence(S, K, T, r, sigma, "call", steps)
        std_errors = [r["std_error"] for r in results]
        assert std_errors[0] > std_errors[-1]

    def test_confidence_interval_contains_bs_price(self):
        bs_p = black_scholes.price(S, K, T, r, sigma, "call")
        mc = monte_carlo.price(S, K, T, r, sigma, "call", n_paths=200_000)
        assert mc["confidence_lower"] < bs_p < mc["confidence_upper"]
