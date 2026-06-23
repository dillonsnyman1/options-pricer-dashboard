#include "options.hpp"

#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

static int g_total = 0, g_failed = 0;

#define EXPECT_NEAR(got, expected, tol, label)                            \
    do {                                                                   \
        ++g_total;                                                         \
        if (std::abs((got) - (expected)) > (tol)) {                       \
            ++g_failed;                                                    \
            std::cerr << "FAIL [" << (label) << "]: got " << (got)        \
                      << ", expected " << (expected)                       \
                      << " (tol " << (tol) << ")\n";                      \
        }                                                                  \
    } while (0)

#define EXPECT_TRUE(cond, label)                                          \
    do {                                                                   \
        ++g_total;                                                         \
        if (!(cond)) {                                                     \
            ++g_failed;                                                    \
            std::cerr << "FAIL [" << (label) << "]: condition false\n";   \
        }                                                                  \
    } while (0)

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

struct Case {
    int    id;
    double S, K, T, r, sigma;
    std::string option_type;
};

struct BSExpected {
    int    id;
    double price, delta, gamma, vega, theta, rho;
};

struct BinExpected {
    int    id;
    double european_price, american_price;
};

struct IVExpected {
    int    id;
    double implied_vol;
};

static std::vector<Case> load_cases(const std::string& path) {
    std::ifstream f(path);
    std::string line;
    std::getline(f, line);  // header
    std::vector<Case> rows;
    while (std::getline(f, line)) {
        std::istringstream ss(line);
        std::string tok;
        Case c;
        std::getline(ss, tok, ','); c.id          = std::stoi(tok);
        std::getline(ss, tok, ','); c.S            = std::stod(tok);
        std::getline(ss, tok, ','); c.K            = std::stod(tok);
        std::getline(ss, tok, ','); c.T            = std::stod(tok);
        std::getline(ss, tok, ','); c.r            = std::stod(tok);
        std::getline(ss, tok, ','); c.sigma        = std::stod(tok);
        std::getline(ss, tok, ','); c.option_type  = tok;
        rows.push_back(c);
    }
    return rows;
}

static std::vector<BSExpected> load_bs(const std::string& path) {
    std::ifstream f(path);
    std::string line;
    std::getline(f, line);
    std::vector<BSExpected> rows;
    while (std::getline(f, line)) {
        std::istringstream ss(line);
        std::string tok;
        BSExpected e;
        std::getline(ss, tok, ','); e.id    = std::stoi(tok);
        std::getline(ss, tok, ','); e.price = std::stod(tok);
        std::getline(ss, tok, ','); e.delta = std::stod(tok);
        std::getline(ss, tok, ','); e.gamma = std::stod(tok);
        std::getline(ss, tok, ','); e.vega  = std::stod(tok);
        std::getline(ss, tok, ','); e.theta = std::stod(tok);
        std::getline(ss, tok, ','); e.rho   = std::stod(tok);
        rows.push_back(e);
    }
    return rows;
}

static std::vector<BinExpected> load_binomial(const std::string& path) {
    std::ifstream f(path);
    std::string line;
    std::getline(f, line);
    std::vector<BinExpected> rows;
    while (std::getline(f, line)) {
        std::istringstream ss(line);
        std::string tok;
        BinExpected e;
        std::getline(ss, tok, ','); e.id             = std::stoi(tok);
        std::getline(ss, tok, ','); e.european_price = std::stod(tok);
        std::getline(ss, tok, ','); e.american_price = std::stod(tok);
        rows.push_back(e);
    }
    return rows;
}

static std::vector<IVExpected> load_iv(const std::string& path) {
    std::ifstream f(path);
    std::string line;
    std::getline(f, line);
    std::vector<IVExpected> rows;
    while (std::getline(f, line)) {
        std::istringstream ss(line);
        std::string tok;
        IVExpected e;
        std::getline(ss, tok, ','); e.id          = std::stoi(tok);
        std::getline(ss, tok, ','); e.implied_vol = std::stod(tok);
        rows.push_back(e);
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

int main() {
    const std::string FIX = "../fixtures/";
    auto cases  = load_cases(FIX + "test_cases.csv");
    auto bs_exp = load_bs(FIX + "expected_bs.csv");
    auto iv_exp = load_iv(FIX + "expected_iv.csv");
    auto bin_exp = load_binomial(FIX + "expected_binomial.csv");

    // ---- Black-Scholes price -----------------------------------------------
    for (int i = 0; i < (int)cases.size(); ++i) {
        auto& c = cases[i];
        double price = options::bs_price(c.S, c.K, c.T, c.r, c.sigma, c.option_type);
        std::string lbl = "bs_price case " + std::to_string(c.id);
        EXPECT_NEAR(price, bs_exp[i].price, 1e-4, lbl);
    }

    // Put-call parity: C - P = S - K*exp(-rT)
    {
        auto& c = cases[0];
        double call   = options::bs_price(c.S, c.K, c.T, c.r, c.sigma, "call");
        double put    = options::bs_price(c.S, c.K, c.T, c.r, c.sigma, "put");
        double parity = c.S - c.K * std::exp(-c.r * c.T);
        EXPECT_NEAR(call - put, parity, 1e-8, "put-call parity");
    }

    // ---- Greeks ------------------------------------------------------------
    for (int i = 0; i < (int)cases.size(); ++i) {
        auto& c = cases[i];
        auto  g = options::bs_greeks(c.S, c.K, c.T, c.r, c.sigma, c.option_type);
        auto& e = bs_exp[i];
        std::string pre = "greeks case " + std::to_string(c.id) + " ";
        EXPECT_NEAR(g.delta, e.delta, 1e-4, pre + "delta");
        EXPECT_NEAR(g.gamma, e.gamma, 1e-4, pre + "gamma");
        EXPECT_NEAR(g.vega,  e.vega,  1e-4, pre + "vega");
        EXPECT_NEAR(g.theta, e.theta, 1e-4, pre + "theta");
        EXPECT_NEAR(g.rho,   e.rho,   1e-4, pre + "rho");
        EXPECT_TRUE(g.gamma > 0.0, pre + "gamma positive");
        EXPECT_TRUE(g.vega  > 0.0, pre + "vega positive");
    }

    // ---- Implied vol (round-trip) ------------------------------------------
    for (int i = 0; i < (int)cases.size(); ++i) {
        auto& c   = cases[i];
        double mkt = options::bs_price(c.S, c.K, c.T, c.r, c.sigma, c.option_type);
        double iv  = options::implied_vol(mkt, c.S, c.K, c.T, c.r, c.option_type);
        std::string lbl = "iv case " + std::to_string(c.id);
        EXPECT_NEAR(iv, iv_exp[i].implied_vol, 1e-4, lbl);
    }

    // ---- Binomial tree -----------------------------------------------------
    for (int i = 0; i < (int)cases.size(); ++i) {
        auto& c   = cases[i];
        auto  res = options::binomial_tree(c.S, c.K, c.T, c.r, c.sigma, c.option_type, 200);
        auto& e   = bin_exp[i];
        std::string pre = "binomial case " + std::to_string(c.id) + " ";
        EXPECT_NEAR(res.european_price, e.european_price, 0.05, pre + "European");
        EXPECT_NEAR(res.american_price, e.american_price, 0.05, pre + "American");
        EXPECT_TRUE(res.american_price >= res.european_price - 1e-9, pre + "Am >= Eur");
    }

    // Deep ITM put: American should be ~30 (intrinsic), large early exercise premium
    {
        auto res = options::binomial_tree(100, 130, 1.0, 0.05, 0.20, "put", 200);
        EXPECT_TRUE(res.american_price >= 29.9, "deep ITM put american >= 29.9");
        EXPECT_TRUE(res.early_exercise_premium > 4.0, "deep ITM put premium > 4");
    }

    // Call on non-dividend-paying stock: never optimal to exercise early
    {
        auto res = options::binomial_tree(100, 100, 1.0, 0.05, 0.20, "call", 200);
        EXPECT_NEAR(res.early_exercise_premium, 0.0, 1e-6, "call no early exercise");
    }

    // ---- Monte Carlo -------------------------------------------------------
    for (auto& c : cases) {
        double ref = options::bs_price(c.S, c.K, c.T, c.r, c.sigma, c.option_type);
        auto   mc  = options::monte_carlo(c.S, c.K, c.T, c.r, c.sigma, c.option_type, 100000, 42);
        std::string lbl = "MC case " + std::to_string(c.id) + " within 3 SEs";
        EXPECT_TRUE(std::abs(mc.price - ref) < 3.0 * mc.std_error, lbl);
        EXPECT_TRUE(mc.price >= 0.0, "MC price non-negative case " + std::to_string(c.id));
    }

    // ---- Barrier MC -------------------------------------------------------
    {
        double vanilla = options::bs_price(100, 100, 1.0, 0.05, 0.20, "call");

        // Knock-out <= vanilla
        auto b1 = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                      85, "down_and_out", 50000, 252, 42);
        EXPECT_TRUE(b1.price <= vanilla + 3 * b1.std_error,
                    "barrier knock-out <= vanilla");

        // In-out parity: out + in ~ vanilla
        auto b_out = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                         85, "down_and_out", 50000, 252, 42);
        auto b_in  = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                         85, "down_and_in", 50000, 252, 42);
        EXPECT_TRUE(std::abs((b_out.price + b_in.price) - vanilla) < 0.5,
                    "barrier in-out parity");

        // Far barrier approaches vanilla
        auto b_far = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                         10, "down_and_out", 50000, 252, 42);
        EXPECT_TRUE(std::abs(b_far.price - vanilla) < 3 * b_far.std_error,
                    "barrier far from spot ~ vanilla");

        // Up-and-out near spot is cheap
        auto b_near = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                          102, "up_and_out", 50000, 252, 42);
        EXPECT_TRUE(b_near.price < vanilla * 0.1,
                    "up-and-out near spot is cheap");
        EXPECT_TRUE(b_near.barrier_hit_pct > 80.0,
                    "up-and-out near spot hit pct > 80");

        // Seed reproducibility
        auto br1 = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                       85, "down_and_out", 1000, 252, 7);
        auto br2 = options::barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                       85, "down_and_out", 1000, 252, 7);
        EXPECT_NEAR(br1.price, br2.price, 1e-12, "barrier MC seed reproducible");
    }

    // ---- Asian MC ---------------------------------------------------------
    {
        double vanilla = options::bs_price(100, 100, 1.0, 0.05, 0.20, "call");

        // Fixed-strike cheaper than vanilla
        auto a1 = options::asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                    "fixed_strike", 50000, 252, 42);
        EXPECT_TRUE(a1.price < vanilla, "asian fixed-strike < vanilla");
        EXPECT_TRUE(a1.price > 0.0, "asian fixed-strike positive");

        // Floating-strike positive
        auto a2 = options::asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                    "floating_strike", 50000, 252, 42);
        EXPECT_TRUE(a2.price > 0.0, "asian floating-strike positive");

        // Put fixed-strike positive
        auto a3 = options::asian_mc(100, 100, 1.0, 0.05, 0.20, "put",
                                    "fixed_strike", 50000, 252, 42);
        EXPECT_TRUE(a3.price > 0.0, "asian put fixed-strike positive");

        // Seed reproducibility
        auto ar1 = options::asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                     "fixed_strike", 1000, 252, 7);
        auto ar2 = options::asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                                     "fixed_strike", 1000, 252, 7);
        EXPECT_NEAR(ar1.price, ar2.price, 1e-12, "asian MC seed reproducible");
    }

    // ---- Summary -----------------------------------------------------------
    int passed = g_total - g_failed;
    std::cout << passed << "/" << g_total << " tests passed";
    if (g_failed > 0) std::cout << " (" << g_failed << " failed)";
    std::cout << "\n";
    return g_failed > 0 ? 1 : 0;
}
