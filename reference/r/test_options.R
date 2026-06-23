library(testthat)

# Locate the script directory whether run with Rscript or sourced interactively
.script_dir <- local({
    args <- commandArgs(trailingOnly = FALSE)
    flag <- grep("^--file=", args, value = TRUE)
    if (length(flag)) {
        dirname(normalizePath(sub("^--file=", "", flag)))
    } else if (!is.null(sys.frame(1)$ofile)) {
        dirname(normalizePath(sys.frame(1)$ofile))
    } else {
        getwd()
    }
})

source(file.path(.script_dir, "options.R"))

FIXTURES <- file.path(.script_dir, "..", "fixtures")

cases    <- read.csv(file.path(FIXTURES, "test_cases.csv"), stringsAsFactors = FALSE)
exp_bs   <- read.csv(file.path(FIXTURES, "expected_bs.csv"))
exp_iv   <- read.csv(file.path(FIXTURES, "expected_iv.csv"))
exp_bin  <- read.csv(file.path(FIXTURES, "expected_binomial.csv"))

# ---- Black-Scholes price ---------------------------------------------------

test_that("bs_price matches fixtures", {
    for (i in seq_len(nrow(cases))) {
        row  <- cases[i, ]
        cid  <- row$case_id
        got  <- bs_price(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        exp  <- exp_bs$price[exp_bs$case_id == cid]
        expect_lt(abs(got - exp), 1e-4,
                  label = sprintf("case %d price", cid))
    }
})

test_that("put-call parity holds", {
    row  <- cases[cases$case_id == 1, ]
    call <- bs_price(row$S, row$K, row$T, row$r, row$sigma, "call")
    put  <- bs_price(row$S, row$K, row$T, row$r, row$sigma, "put")
    parity <- row$S - row$K * exp(-row$r * row$T)
    expect_lt(abs((call - put) - parity), 1e-8)
})

# ---- Greeks ----------------------------------------------------------------

test_that("greeks match fixtures", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        cid <- row$case_id
        g   <- bs_greeks(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        ref <- exp_bs[exp_bs$case_id == cid, ]
        for (name in c("delta", "gamma", "vega", "theta", "rho")) {
            expect_lt(abs(g[[name]] - ref[[name]]), 1e-4,
                      label = sprintf("case %d %s", cid, name))
        }
    }
})

test_that("call delta in (0, 1)", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        if (row$option_type != "call") next
        g <- bs_greeks(row$S, row$K, row$T, row$r, row$sigma, "call")
        expect_gt(g$delta, 0.0)
        expect_lt(g$delta, 1.0)
    }
})

test_that("put delta in (-1, 0)", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        if (row$option_type != "put") next
        g <- bs_greeks(row$S, row$K, row$T, row$r, row$sigma, "put")
        expect_gt(g$delta, -1.0)
        expect_lt(g$delta,  0.0)
    }
})

test_that("gamma is positive", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        g   <- bs_greeks(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        expect_gt(g$gamma, 0.0)
    }
})

test_that("vega is positive", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        g   <- bs_greeks(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        expect_gt(g$vega, 0.0)
    }
})

# ---- Implied vol -----------------------------------------------------------

test_that("implied_vol round-trip matches fixtures", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        cid <- row$case_id
        mkt <- bs_price(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        iv  <- implied_vol(mkt, row$S, row$K, row$T, row$r, row$option_type)
        exp <- exp_iv$implied_vol[exp_iv$case_id == cid]
        expect_lt(abs(iv - exp), 1e-4, label = sprintf("case %d iv", cid))
    }
})

# ---- Binomial tree ---------------------------------------------------------

test_that("binomial prices match fixtures", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        cid <- row$case_id
        res <- binomial_tree(row$S, row$K, row$T, row$r, row$sigma, row$option_type, n_steps = 200L)
        ref <- exp_bin[exp_bin$case_id == cid, ]
        expect_lt(abs(res$european_price - ref$european_price), 0.05,
                  label = sprintf("case %d European", cid))
        expect_lt(abs(res$american_price - ref$american_price), 0.05,
                  label = sprintf("case %d American", cid))
    }
})

test_that("American price >= European price", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        res <- binomial_tree(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        expect_gte(res$american_price, res$european_price - 1e-9)
    }
})

test_that("deep ITM put has large early exercise premium", {
    res <- binomial_tree(100, 130, 1.0, 0.05, 0.20, "put", n_steps = 200L)
    expect_gte(res$american_price, 29.9)
    expect_gt(res$early_exercise_premium, 4.0)
})

test_that("call has no early exercise premium", {
    res <- binomial_tree(100, 100, 1.0, 0.05, 0.20, "call", n_steps = 200L)
    expect_lt(abs(res$early_exercise_premium), 1e-6)
})

# ---- Monte Carlo -----------------------------------------------------------

test_that("MC price within 3 SEs of BS price", {
    for (i in seq_len(nrow(cases))) {
        row <- cases[i, ]
        ref <- bs_price(row$S, row$K, row$T, row$r, row$sigma, row$option_type)
        mc  <- monte_carlo(row$S, row$K, row$T, row$r, row$sigma, row$option_type,
                           n_paths = 100000L, seed = 42L)
        expect_lt(abs(mc$price - ref), 3.0 * mc$std_error,
                  label = sprintf("case %d MC convergence", row$case_id))
    }
})

test_that("MC result is reproducible with same seed", {
    r1 <- monte_carlo(100, 100, 1.0, 0.05, 0.20, "call", n_paths = 1000L, seed = 7L)
    r2 <- monte_carlo(100, 100, 1.0, 0.05, 0.20, "call", n_paths = 1000L, seed = 7L)
    expect_equal(r1$price, r2$price)
})

# ---- Barrier MC --------------------------------------------------------------

test_that("barrier knock-out price <= vanilla", {
    vanilla <- bs_price(100, 100, 1.0, 0.05, 0.20, "call")
    b <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                    barrier = 85, barrier_type = "down_and_out", n_paths = 50000L)
    expect_lte(b$price, vanilla + 3 * b$std_error)
})

test_that("barrier in-out parity", {
    vanilla <- bs_price(100, 100, 1.0, 0.05, 0.20, "call")
    b_out <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                        barrier = 85, barrier_type = "down_and_out",
                        n_paths = 50000L, seed = 42L)
    b_in <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                       barrier = 85, barrier_type = "down_and_in",
                       n_paths = 50000L, seed = 42L)
    expect_lt(abs((b_out$price + b_in$price) - vanilla), 0.5)
})

test_that("barrier far from spot approaches vanilla", {
    vanilla <- bs_price(100, 100, 1.0, 0.05, 0.20, "call")
    b <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                    barrier = 10, barrier_type = "down_and_out", n_paths = 50000L)
    expect_lt(abs(b$price - vanilla), 3 * b$std_error)
})

test_that("up-and-out near spot is cheap", {
    vanilla <- bs_price(100, 100, 1.0, 0.05, 0.20, "call")
    b <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                    barrier = 100 * 1.02, barrier_type = "up_and_out", n_paths = 50000L)
    expect_lt(b$price, vanilla * 0.1)
    expect_gt(b$barrier_hit_pct, 80.0)
})

test_that("barrier MC is reproducible with same seed", {
    r1 <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                     barrier = 85, barrier_type = "down_and_out",
                     n_paths = 1000L, seed = 7L)
    r2 <- barrier_mc(100, 100, 1.0, 0.05, 0.20, "call",
                     barrier = 85, barrier_type = "down_and_out",
                     n_paths = 1000L, seed = 7L)
    expect_equal(r1$price, r2$price)
})

# ---- Asian MC ----------------------------------------------------------------

test_that("Asian fixed-strike cheaper than vanilla", {
    vanilla <- bs_price(100, 100, 1.0, 0.05, 0.20, "call")
    a <- asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                  asian_type = "fixed_strike", n_paths = 50000L)
    expect_lt(a$price, vanilla)
})

test_that("Asian fixed-strike price is positive", {
    a <- asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                  asian_type = "fixed_strike", n_paths = 50000L)
    expect_gt(a$price, 0.0)
})

test_that("Asian floating-strike price is positive", {
    a <- asian_mc(100, 100, 1.0, 0.05, 0.20, "call",
                  asian_type = "floating_strike", n_paths = 50000L)
    expect_gt(a$price, 0.0)
})

test_that("Asian put fixed-strike price is positive", {
    a <- asian_mc(100, 100, 1.0, 0.05, 0.20, "put",
                  asian_type = "fixed_strike", n_paths = 50000L)
    expect_gt(a$price, 0.0)
})

test_that("Asian MC is reproducible with same seed", {
    r1 <- asian_mc(100, 100, 1.0, 0.05, 0.20, "call", n_paths = 1000L, seed = 7L)
    r2 <- asian_mc(100, 100, 1.0, 0.05, 0.20, "call", n_paths = 1000L, seed = 7L)
    expect_equal(r1$price, r2$price)
})
