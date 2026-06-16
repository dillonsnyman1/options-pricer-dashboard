import os

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    BinomialResult,
    BSResult,
    Greeks,
    GreeksSensitivityRequest,
    IVSmilePoint,
    IVSmileRequest,
    MCConvergencePoint,
    MCConvergenceRequest,
    MCConvergenceResponse,
    MCResult,
    PnLHeatmapRequest,
    PnLHeatmapResponse,
    PriceRequest,
    PriceResponse,
)
from app.pricing import binomial_tree, black_scholes, monte_carlo

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="Options Pricer & Greeks Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MC_CONVERGENCE_STEPS = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 200_000]


@app.post("/api/price", response_model=PriceResponse)
def price_option(req: PriceRequest) -> PriceResponse:
    opt = req.option_type.value

    bs_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)
    bs_g = black_scholes.greeks(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)

    mc = monte_carlo.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.n_paths, q=req.q)

    bin_ = binomial_tree.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.n_steps, req.q)

    return PriceResponse(
        bs=BSResult(price=bs_price, greeks=Greeks(**bs_g)),
        mc=MCResult(**mc),
        binomial=BinomialResult(**bin_),
    )


@app.post("/api/greeks-sensitivity")
def greeks_sensitivity(req: GreeksSensitivityRequest) -> list[dict]:
    opt = req.option_type.value

    vary = req.vary_param.value
    if vary == "spot":
        values = np.linspace(req.S * 0.5, req.S * 1.5, req.n_points)
        def params(v): return (v, req.K, req.T, req.r, req.sigma)
    elif vary == "vol":
        lo = max(0.01, req.sigma * 0.25)
        values = np.linspace(lo, req.sigma * 3.0, req.n_points)
        def params(v): return (req.S, req.K, req.T, req.r, v)
    elif vary == "time":
        values = np.linspace(1 / 365, req.T, req.n_points)
        def params(v): return (req.S, req.K, v, req.r, req.sigma)
    else:  # rate
        lo = max(-0.02, req.r - 0.05)
        values = np.linspace(lo, req.r + 0.05, req.n_points)
        def params(v): return (req.S, req.K, req.T, v, req.sigma)

    results = []
    for v in values:
        S, K, T, r, sigma = params(float(v))
        p = black_scholes.price(S, K, T, r, sigma, opt, req.q)
        g = black_scholes.greeks(S, K, T, r, sigma, opt, req.q)
        results.append({"param_value": round(float(v), 8), "price": p, **g})
    return results


@app.post("/api/iv-smile")
def iv_smile(req: IVSmileRequest) -> list[IVSmilePoint]:
    K_min = req.S * (1 - req.strike_range_pct)
    K_max = req.S * (1 + req.strike_range_pct)
    strikes = np.linspace(K_min, K_max, req.n_strikes)

    results = []
    for K in strikes:
        m = float(np.log(K / req.S))
        vol = max(0.005, req.atm_vol + req.skew * m + req.curvature * m**2)

        call_p = black_scholes.price(req.S, float(K), req.T, req.r, vol, "call", req.q)
        put_p = black_scholes.price(req.S, float(K), req.T, req.r, vol, "put", req.q)

        # Back out IV from OTM option price (more numerically stable near ATM)
        if K <= req.S:
            iv = black_scholes.implied_vol(put_p, req.S, float(K), req.T, req.r, "put", req.q)
        else:
            iv = black_scholes.implied_vol(call_p, req.S, float(K), req.T, req.r, "call", req.q)

        results.append(
            IVSmilePoint(
                strike=round(float(K), 4),
                moneyness=round(m, 6),
                implied_vol=round(iv, 6),
                call_price=round(call_p, 6),
                put_price=round(put_p, 6),
            )
        )
    return results


@app.post("/api/mc-convergence", response_model=MCConvergenceResponse)
def mc_convergence(req: MCConvergenceRequest) -> MCConvergenceResponse:
    opt = req.option_type.value
    bs_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)
    paths_data = monte_carlo.price_with_convergence(
        req.S, req.K, req.T, req.r, req.sigma, opt, _MC_CONVERGENCE_STEPS, q=req.q
    )
    return MCConvergenceResponse(
        bs_price=bs_price,
        paths=[MCConvergencePoint(**p) for p in paths_data],
    )


@app.post("/api/pnl-heatmap", response_model=PnLHeatmapResponse)
def pnl_heatmap(req: PnLHeatmapRequest) -> PnLHeatmapResponse:
    opt = req.option_type.value
    current_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)

    spots = np.linspace(req.S * (1 - req.spot_range_pct), req.S * (1 + req.spot_range_pct), 20)
    vols = np.linspace(max(0.05, req.sigma / req.vol_range_mult), req.sigma * req.vol_range_mult, 20)

    pnl: list[list[float]] = []
    for vol in vols:
        row = [
            round(black_scholes.price(float(s), req.K, req.T, req.r, float(vol), opt, req.q) - current_price, 4)
            for s in spots
        ]
        pnl.append(row)

    return PnLHeatmapResponse(
        spots=[round(float(s), 2) for s in spots],
        vols=[round(float(v), 6) for v in vols],
        pnl=pnl,
        current_price=round(current_price, 6),
    )


# AWS Lambda entrypoint via Mangum (unused when running locally with uvicorn)
from mangum import Mangum  # noqa: E402

handler = Mangum(app)
