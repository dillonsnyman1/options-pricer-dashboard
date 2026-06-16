#pragma once

/*
 * Black-Scholes option pricing, Greeks, Newton-Raphson IV solver,
 * Monte Carlo with antithetic variates, and CRR binomial tree.
 *
 * Header-only, C++17, no external dependencies.
 *
 * Parameter conventions:
 *   S           - spot price
 *   K           - strike price
 *   T           - time to expiry in years
 *   r           - continuous risk-free rate (e.g. 0.05 for 5%)
 *   sigma       - annualised volatility (e.g. 0.20 for 20%)
 *   option_type - "call" or "put"
 *
 * Vega and Rho are scaled to a 1% move. Theta is per calendar day.
 */

#include <algorithm>
#include <cmath>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

namespace options {

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

namespace detail {

inline double norm_cdf(double x) {
    // erfc avoids catastrophic cancellation near x=0 that occurs with the
    // naive 0.5*(1+erf(...)) form for large negative x.
    return 0.5 * std::erfc(-x / std::sqrt(2.0));
}

inline double norm_pdf(double x) {
    return std::exp(-0.5 * x * x) / std::sqrt(2.0 * M_PI);
}

inline void d1_d2(double S, double K, double T, double r, double sigma,
                  double& d1, double& d2) {
    d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * std::sqrt(T));
    d2 = d1 - sigma * std::sqrt(T);
}

} // namespace detail

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

struct Greeks {
    double delta;
    double gamma;
    double vega;   // per 1% move in vol
    double theta;  // per calendar day
    double rho;    // per 1% move in rate
};

struct MCResult {
    double price;
    double std_error;
    int    n_paths;
};

struct BinomialResult {
    double european_price;
    double american_price;
    double early_exercise_premium;
};

// ---------------------------------------------------------------------------
// Black-Scholes price
// ---------------------------------------------------------------------------

inline double bs_price(double S, double K, double T, double r, double sigma,
                       const std::string& option_type) {
    double d1, d2;
    detail::d1_d2(S, K, T, r, sigma, d1, d2);
    double disc = std::exp(-r * T);

    if (option_type == "call") {
        return S * detail::norm_cdf(d1) - K * disc * detail::norm_cdf(d2);
    }
    return K * disc * detail::norm_cdf(-d2) - S * detail::norm_cdf(-d1);
}

// ---------------------------------------------------------------------------
// Greeks (all analytical from same d1/d2)
// ---------------------------------------------------------------------------

inline Greeks bs_greeks(double S, double K, double T, double r, double sigma,
                        const std::string& option_type) {
    double d1, d2;
    detail::d1_d2(S, K, T, r, sigma, d1, d2);
    double phi  = detail::norm_pdf(d1);
    double sqT  = std::sqrt(T);
    double disc = std::exp(-r * T);

    Greeks g;
    g.gamma = phi / (S * sigma * sqT);
    g.vega  = S * phi * sqT / 100.0;

    if (option_type == "call") {
        g.delta = detail::norm_cdf(d1);
        g.theta = (-(S * phi * sigma / (2.0 * sqT)) - r * K * disc * detail::norm_cdf(d2)) / 365.0;
        g.rho   = K * T * disc * detail::norm_cdf(d2) / 100.0;
    } else {
        g.delta = detail::norm_cdf(d1) - 1.0;
        g.theta = (-(S * phi * sigma / (2.0 * sqT)) + r * K * disc * detail::norm_cdf(-d2)) / 365.0;
        g.rho   = -K * T * disc * detail::norm_cdf(-d2) / 100.0;
    }
    return g;
}

// ---------------------------------------------------------------------------
// Implied volatility (Newton-Raphson)
// ---------------------------------------------------------------------------

inline double implied_vol(double market_price, double S, double K, double T, double r,
                          const std::string& option_type,
                          double tol = 1e-7, int max_iter = 100) {
    double sigma = 0.2;
    for (int i = 0; i < max_iter; ++i) {
        double p = bs_price(S, K, T, r, sigma, option_type);
        double d1, d2;
        detail::d1_d2(S, K, T, r, sigma, d1, d2);
        double vega_raw = S * detail::norm_pdf(d1) * std::sqrt(T);  // unscaled derivative
        double diff = p - market_price;
        if (std::abs(diff) < tol) return sigma;
        if (std::abs(vega_raw) < 1e-12) break;
        sigma -= diff / vega_raw;
        sigma = std::max(1e-6, std::min(sigma, 10.0));  // keep sigma in a sane range
    }
    return sigma;
}

// ---------------------------------------------------------------------------
// Monte Carlo with antithetic variates
// ---------------------------------------------------------------------------

inline MCResult monte_carlo(double S, double K, double T, double r, double sigma,
                             const std::string& option_type,
                             int n_paths = 100000, unsigned seed = 42) {
    // Antithetic variates: pair each draw Z with -Z.
    // For monotone payoffs, f(Z) and f(-Z) are negatively correlated,
    // so their average has lower variance than two independent draws.
    std::mt19937_64 rng(seed);
    std::normal_distribution<double> dist(0.0, 1.0);

    int    half  = n_paths / 2;
    double disc  = std::exp(-r * T);
    double drift = (r - 0.5 * sigma * sigma) * T;
    double vol_t = sigma * std::sqrt(T);

    std::vector<double> payoffs;
    payoffs.reserve(n_paths);

    for (int i = 0; i < half; ++i) {
        double z = dist(rng);
        for (double sign : {1.0, -1.0}) {
            double ST = S * std::exp(drift + vol_t * sign * z);
            double pf = (option_type == "call") ? std::max(ST - K, 0.0) : std::max(K - ST, 0.0);
            payoffs.push_back(disc * pf);
        }
    }

    double mean = 0.0;
    for (double x : payoffs) mean += x;
    mean /= static_cast<double>(payoffs.size());

    double var = 0.0;
    for (double x : payoffs) var += (x - mean) * (x - mean);
    var /= static_cast<double>(payoffs.size() - 1);

    return {mean, std::sqrt(var / payoffs.size()), n_paths};
}

// ---------------------------------------------------------------------------
// CRR binomial tree (European and American in one pass)
// ---------------------------------------------------------------------------

inline BinomialResult binomial_tree(double S, double K, double T, double r, double sigma,
                                     const std::string& option_type, int n_steps = 200) {
    double dt   = T / n_steps;
    double u    = std::exp(sigma * std::sqrt(dt));
    double d    = 1.0 / u;
    double p    = (std::exp(r * dt) - d) / (u - d);
    double disc = std::exp(-r * dt);

    auto payoff = [&](double s) -> double {
        return (option_type == "call") ? std::max(s - K, 0.0) : std::max(K - s, 0.0);
    };

    int N = n_steps + 1;
    std::vector<double> V_eur(N), V_am(N);
    for (int j = 0; j < N; ++j) {
        double ST = S * std::pow(u, n_steps - j) * std::pow(d, j);
        V_eur[j] = payoff(ST);
        V_am[j]  = payoff(ST);
    }

    // European: straightforward backward induction, no early-exercise check
    for (int step = 0; step < n_steps; ++step) {
        int sz = N - step - 1;
        for (int j = 0; j < sz; ++j)
            V_eur[j] = disc * (p * V_eur[j] + (1.0 - p) * V_eur[j + 1]);
    }

    // American: same induction, but take max of continuation and intrinsic at every node
    for (int i = n_steps - 1; i >= 0; --i) {
        for (int j = 0; j <= i; ++j) {
            double cont  = disc * (p * V_am[j] + (1.0 - p) * V_am[j + 1]);
            double S_ij  = S * std::pow(u, i - j) * std::pow(d, j);
            V_am[j] = std::max(cont, payoff(S_ij));
        }
    }

    double eur = V_eur[0];
    double am  = V_am[0];
    return {eur, am, am - eur};
}

} // namespace options
