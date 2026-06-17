"""
Tests for the standalone Python options reference implementation.

Fixtures are loaded from ../fixtures/ and compared with tolerances
appropriate for each method:
  - BS price and Greeks: 1e-4 (analytical, should match closely)
  - Implied vol:         1e-4 (Newton-Raphson round-trip)
  - Binomial:            0.05 (200-step numerical approximation)
  - Monte Carlo:         checked against BS price within 3 standard errors
"""

import csv
import math
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
from options import barrier_mc, binomial_tree, bs_greeks, bs_price, implied_vol, monte_carlo

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def load_csv(filename):
    with open(os.path.join(FIXTURES, filename)) as f:
        return list(csv.DictReader(f))


def float_row(row, *keys):
    return {k: float(row[k]) for k in keys}


@pytest.fixture(scope="module")
def cases():
    return load_csv("test_cases.csv")


@pytest.fixture(scope="module")
def expected_bs():
    return {int(r["case_id"]): r for r in load_csv("expected_bs.csv")}


@pytest.fixture(scope="module")
def expected_iv():
    return {int(r["case_id"]): r for r in load_csv("expected_iv.csv")}


@pytest.fixture(scope="module")
def expected_binomial():
    return {int(r["case_id"]): r for r in load_csv("expected_binomial.csv")}


class TestBSPrice:
    def test_all_cases(self, cases, expected_bs):
        for row in cases:
            cid = int(row["case_id"])
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            opt = row["option_type"]
            price = bs_price(S, K, T, r, sigma, opt)
            expected = float(expected_bs[cid]["price"])
            assert abs(price - expected) < 1e-4, f"case {cid}: price {price:.6f} != {expected:.6f}"

    def test_put_call_parity(self, cases):
        # C - P = S - K*exp(-rT) for same S, K, T, r, sigma
        row = next(r for r in cases if int(r["case_id"]) == 1)
        S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
        call = bs_price(S, K, T, r, sigma, "call")
        put  = bs_price(S, K, T, r, sigma, "put")
        parity = S - K * math.exp(-r * T)
        assert abs((call - put) - parity) < 1e-8


class TestGreeks:
    def test_all_cases(self, cases, expected_bs):
        for row in cases:
            cid = int(row["case_id"])
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            g = bs_greeks(S, K, T, r, sigma, row["option_type"])
            for name in ("delta", "gamma", "vega", "theta", "rho"):
                got = g[name]
                exp = float(expected_bs[cid][name])
                assert abs(got - exp) < 1e-4, f"case {cid} {name}: {got:.6f} != {exp:.6f}"

    def test_call_delta_bounds(self, cases):
        for row in cases:
            if row["option_type"] != "call":
                continue
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            g = bs_greeks(S, K, T, r, sigma, "call")
            assert 0.0 < g["delta"] < 1.0

    def test_put_delta_bounds(self, cases):
        for row in cases:
            if row["option_type"] != "put":
                continue
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            g = bs_greeks(S, K, T, r, sigma, "put")
            assert -1.0 < g["delta"] < 0.0

    def test_gamma_positive(self, cases):
        for row in cases:
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            g = bs_greeks(S, K, T, r, sigma, row["option_type"])
            assert g["gamma"] > 0.0

    def test_vega_positive(self, cases):
        for row in cases:
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            g = bs_greeks(S, K, T, r, sigma, row["option_type"])
            assert g["vega"] > 0.0


class TestImpliedVol:
    def test_roundtrip(self, cases, expected_iv):
        for row in cases:
            cid = int(row["case_id"])
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            opt = row["option_type"]
            mkt = bs_price(S, K, T, r, sigma, opt)
            iv = implied_vol(mkt, S, K, T, r, opt)
            expected = float(expected_iv[cid]["implied_vol"])
            assert abs(iv - expected) < 1e-4, f"case {cid}: iv {iv:.6f} != {expected:.6f}"


class TestBinomialTree:
    def test_all_cases(self, cases, expected_binomial):
        for row in cases:
            cid = int(row["case_id"])
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            result = binomial_tree(S, K, T, r, sigma, row["option_type"], n_steps=200)
            exp_eur = float(expected_binomial[cid]["european_price"])
            exp_am  = float(expected_binomial[cid]["american_price"])
            assert abs(result["european_price"] - exp_eur) < 0.05, f"case {cid} European: {result['european_price']:.4f} != {exp_eur:.4f}"
            assert abs(result["american_price"] - exp_am)  < 0.05, f"case {cid} American: {result['american_price']:.4f} != {exp_am:.4f}"

    def test_american_ge_european(self, cases):
        for row in cases:
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            result = binomial_tree(S, K, T, r, sigma, row["option_type"])
            assert result["american_price"] >= result["european_price"] - 1e-9

    def test_deep_itm_put_early_exercise(self):
        # S=100, K=130: intrinsic = 30.0, American should be ~30.0
        result = binomial_tree(100, 130, 1.0, 0.05, 0.20, "put", n_steps=200)
        assert result["american_price"] >= 29.9
        assert result["early_exercise_premium"] > 4.0

    def test_call_no_early_exercise(self):
        # Call on non-dividend-paying stock: American = European
        result = binomial_tree(100, 100, 1.0, 0.05, 0.20, "call", n_steps=200)
        assert abs(result["early_exercise_premium"]) < 1e-6


class TestMonteCarlo:
    def test_convergence_to_bs(self, cases):
        # With enough paths the MC price should be within 3 SEs of BS
        for row in cases:
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            opt = row["option_type"]
            ref = bs_price(S, K, T, r, sigma, opt)
            mc = monte_carlo(S, K, T, r, sigma, opt, n_paths=100_000, seed=42)
            assert abs(mc["price"] - ref) < 3.0 * mc["std_error"], (
                f"MC price {mc['price']:.4f} more than 3 SEs from BS {ref:.4f} "
                f"(SE={mc['std_error']:.4f})"
            )

    def test_price_positive(self, cases):
        for row in cases:
            S, K, T, r, sigma = float(row["S"]), float(row["K"]), float(row["T"]), float(row["r"]), float(row["sigma"])
            mc = monte_carlo(S, K, T, r, sigma, row["option_type"], n_paths=10_000, seed=1)
            assert mc["price"] >= 0.0

    def test_seed_reproducible(self):
        args = (100, 100, 1.0, 0.05, 0.20, "call")
        r1 = monte_carlo(*args, n_paths=1000, seed=7)
        r2 = monte_carlo(*args, n_paths=1000, seed=7)
        assert r1["price"] == r2["price"]


class TestBarrierMC:
    S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.20

    def test_knock_out_le_vanilla(self):
        vanilla = bs_price(self.S, self.K, self.T, self.r, self.sigma, "call")
        b = barrier_mc(self.S, self.K, self.T, self.r, self.sigma, "call",
                       barrier=85, barrier_type="down_and_out", n_paths=50_000)
        assert b["price"] <= vanilla + 3 * b["std_error"]

    def test_in_out_parity(self):
        args = (self.S, self.K, self.T, self.r, self.sigma, "call")
        vanilla = bs_price(*args)
        b_out = barrier_mc(*args, barrier=85, barrier_type="down_and_out", n_paths=50_000, seed=42)
        b_in = barrier_mc(*args, barrier=85, barrier_type="down_and_in", n_paths=50_000, seed=42)
        assert abs((b_out["price"] + b_in["price"]) - vanilla) < 0.5

    def test_far_barrier_approaches_vanilla(self):
        vanilla = bs_price(self.S, self.K, self.T, self.r, self.sigma, "call")
        b = barrier_mc(self.S, self.K, self.T, self.r, self.sigma, "call",
                       barrier=10, barrier_type="down_and_out", n_paths=50_000)
        assert abs(b["price"] - vanilla) < 3 * b["std_error"]

    def test_up_and_out_near_spot_is_cheap(self):
        vanilla = bs_price(self.S, self.K, self.T, self.r, self.sigma, "call")
        b = barrier_mc(self.S, self.K, self.T, self.r, self.sigma, "call",
                       barrier=self.S * 1.02, barrier_type="up_and_out", n_paths=50_000)
        assert b["price"] < vanilla * 0.1
        assert b["barrier_hit_pct"] > 80.0

    def test_seed_reproducible(self):
        args = (self.S, self.K, self.T, self.r, self.sigma, "call")
        r1 = barrier_mc(*args, barrier=85, barrier_type="down_and_out", n_paths=1000, seed=7)
        r2 = barrier_mc(*args, barrier=85, barrier_type="down_and_out", n_paths=1000, seed=7)
        assert r1["price"] == r2["price"]
