# Black-Scholes option pricing, Greeks, Newton-Raphson IV solver,
# Monte Carlo with antithetic variates, and CRR binomial tree.
#
# No package dependencies - pnorm/dnorm/rnorm are all base R.
#
# Parameter conventions match the Python reference:
#   S           - spot price
#   K           - strike price
#   T           - time to expiry in years
#   r           - continuous risk-free rate (e.g. 0.05 for 5%)
#   sigma       - annualised volatility (e.g. 0.20 for 20%)
#   option_type - 'call' or 'put'
#
# Vega and Rho are scaled to a 1% move. Theta is per calendar day.

.d1_d2 <- function(S, K, T, r, sigma) {
    d1 <- (log(S / K) + (r + 0.5 * sigma^2) * T) / (sigma * sqrt(T))
    c(d1 = d1, d2 = d1 - sigma * sqrt(T))
}

bs_price <- function(S, K, T, r, sigma, option_type) {
    dd   <- .d1_d2(S, K, T, r, sigma)
    disc <- exp(-r * T)
    if (option_type == "call") {
        return(S * pnorm(dd["d1"]) - K * disc * pnorm(dd["d2"]))
    }
    K * disc * pnorm(-dd["d2"]) - S * pnorm(-dd["d1"])
}

bs_greeks <- function(S, K, T, r, sigma, option_type) {
    dd   <- .d1_d2(S, K, T, r, sigma)
    d1   <- dd["d1"]
    d2   <- dd["d2"]
    phi  <- dnorm(d1)
    sqT  <- sqrt(T)
    disc <- exp(-r * T)

    delta <- if (option_type == "call") pnorm(d1) else pnorm(d1) - 1.0
    gamma <- phi / (S * sigma * sqT)
    vega  <- S * phi * sqT / 100.0   # per 1% move in vol

    if (option_type == "call") {
        theta <- (-(S * phi * sigma / (2.0 * sqT)) - r * K * disc * pnorm(d2))  / 365.0
        rho   <- K * T * disc * pnorm(d2) / 100.0   # per 1% move in rate
    } else {
        theta <- (-(S * phi * sigma / (2.0 * sqT)) + r * K * disc * pnorm(-d2)) / 365.0
        rho   <- -K * T * disc * pnorm(-d2) / 100.0
    }

    list(delta = delta, gamma = gamma, vega = vega, theta = theta, rho = rho)
}

implied_vol <- function(market_price, S, K, T, r, option_type,
                        tol = 1e-7, max_iter = 100L) {
    sigma <- 0.2
    for (i in seq_len(max_iter)) {
        p        <- bs_price(S, K, T, r, sigma, option_type)
        d1       <- .d1_d2(S, K, T, r, sigma)["d1"]
        vega_raw <- S * dnorm(d1) * sqrt(T)  # unscaled, used as derivative
        diff     <- p - market_price
        if (abs(diff) < tol)       return(sigma)
        if (abs(vega_raw) < 1e-12) break
        sigma <- sigma - diff / vega_raw
        sigma <- max(1e-6, min(sigma, 10.0))   # keep sigma in a sane range
    }
    sigma
}

monte_carlo <- function(S, K, T, r, sigma, option_type,
                        n_paths = 100000L, seed = 42L) {
    # Antithetic variates: pair each Z draw with -Z.
    # For monotone payoffs, f(Z) and f(-Z) are negatively correlated,
    # so averaging them reduces variance vs. two independent draws.
    set.seed(seed)
    half   <- n_paths %/% 2L
    Z      <- rnorm(half)
    Z_full <- c(Z, -Z)

    disc <- exp(-r * T)
    ST   <- S * exp((r - 0.5 * sigma^2) * T + sigma * sqrt(T) * Z_full)
    pf   <- if (option_type == "call") pmax(ST - K, 0.0) else pmax(K - ST, 0.0)
    disc_pf <- disc * pf

    price     <- mean(disc_pf)
    std_error <- sd(disc_pf) / sqrt(n_paths)

    list(price = price, std_error = std_error, n_paths = n_paths)
}

binomial_tree <- function(S, K, T, r, sigma, option_type, n_steps = 200L) {
    dt   <- T / n_steps
    u    <- exp(sigma * sqrt(dt))
    d    <- 1.0 / u
    p    <- (exp(r * dt) - d) / (u - d)
    disc <- exp(-r * dt)

    j    <- 0L:n_steps
    ST   <- S * u^(n_steps - j) * d^j
    payoff_fn <- if (option_type == "call") {
        function(s) pmax(s - K, 0.0)
    } else {
        function(s) pmax(K - s, 0.0)
    }

    V_eur <- payoff_fn(ST)
    V_am  <- payoff_fn(ST)

    # European: straightforward backward induction
    for (step in seq_len(n_steps)) {
        n     <- length(V_eur)
        V_eur <- disc * (p * V_eur[-n] + (1.0 - p) * V_eur[-1L])
    }

    # American: same induction but check intrinsic at every node
    for (i in seq(n_steps - 1L, 0L)) {
        n    <- length(V_am)
        V_am <- disc * (p * V_am[-n] + (1.0 - p) * V_am[-1L])
        j_nodes  <- 0L:i
        ST_nodes <- S * u^(i - j_nodes) * d^j_nodes
        V_am <- pmax(V_am, payoff_fn(ST_nodes))
    }

    eur <- V_eur[[1L]]
    am  <- V_am[[1L]]
    list(
        european_price        = eur,
        american_price        = am,
        early_exercise_premium = am - eur
    )
}
