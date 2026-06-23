import os

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import HTTPException

from app.models import (
    AsianPriceRequest,
    AsianPriceResponse,
    AsianSamplePath,
    BarrierPriceRequest,
    BarrierPriceResponse,
    BinomialResult,
    BSResult,
    Greeks,
    GreeksSensitivityRequest,
    IVSmilePoint,
    IVSmileRequest,
    MarketSmilePoint,
    MarketSmileRequest,
    MarketSmileResponse,
    MCConvergencePoint,
    MCConvergenceRequest,
    MCConvergenceResponse,
    MCResult,
    PnLHeatmapRequest,
    PnLHeatmapResponse,
    PortfolioGreeksRequest,
    PortfolioGreeksResponse,
    PortfolioPnLHeatmapRequest,
    PortfolioPnLHeatmapResponse,
    PortfolioPositionGreeks,
    PriceRequest,
    PriceResponse,
    SamplePath,
)
from app.pricing import asian, barrier, binomial_tree, black_scholes, monte_carlo

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
    divs = [(d.t, d.D) for d in req.discrete_dividends]

    bs_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q, divs)
    bs_g = black_scholes.greeks(req.S, req.K, req.T, req.r, req.sigma, opt, req.q, divs)

    mc = monte_carlo.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.n_paths, q=req.q, discrete_dividends=divs)

    bin_ = binomial_tree.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.n_steps, req.q, divs)

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

    divs = [(d.t, d.D) for d in req.discrete_dividends]
    results = []
    for v in values:
        S, K, T, r, sigma = params(float(v))
        p = black_scholes.price(S, K, T, r, sigma, opt, req.q, divs)
        g = black_scholes.greeks(S, K, T, r, sigma, opt, req.q, divs)
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
    divs = [(d.t, d.D) for d in req.discrete_dividends]
    bs_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q, divs)
    paths_data = monte_carlo.price_with_convergence(
        req.S, req.K, req.T, req.r, req.sigma, opt, _MC_CONVERGENCE_STEPS, q=req.q, discrete_dividends=divs
    )
    return MCConvergenceResponse(
        bs_price=bs_price,
        paths=[MCConvergencePoint(**p) for p in paths_data],
    )


@app.post("/api/pnl-heatmap", response_model=PnLHeatmapResponse)
def pnl_heatmap(req: PnLHeatmapRequest) -> PnLHeatmapResponse:
    opt = req.option_type.value
    divs = [(d.t, d.D) for d in req.discrete_dividends]
    current_price = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q, divs)

    spots = np.linspace(req.S * (1 - req.spot_range_pct), req.S * (1 + req.spot_range_pct), 20)
    vols = np.linspace(max(0.05, req.sigma / req.vol_range_mult), req.sigma * req.vol_range_mult, 20)

    pnl: list[list[float]] = []
    for vol in vols:
        row = [
            round(black_scholes.price(float(s), req.K, req.T, req.r, float(vol), opt, req.q, divs) - current_price, 4)
            for s in spots
        ]
        pnl.append(row)

    return PnLHeatmapResponse(
        spots=[round(float(s), 2) for s in spots],
        vols=[round(float(v), 6) for v in vols],
        pnl=pnl,
        current_price=round(current_price, 6),
    )


@app.post("/api/asian-price", response_model=AsianPriceResponse)
def asian_price(req: AsianPriceRequest) -> AsianPriceResponse:
    opt = req.option_type.value
    vanilla = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)
    mc = asian.price_asian_mc(
        req.S, req.K, req.T, req.r, req.sigma, opt,
        req.asian_type.value, q=req.q,
        n_paths=req.n_paths, n_steps=req.n_steps, n_sample_paths=req.n_sample_paths,
    )
    return AsianPriceResponse(
        vanilla_price=round(vanilla, 6),
        sample_paths=[AsianSamplePath(**p) for p in mc.pop("sample_paths")],
        **mc,
    )


@app.post("/api/barrier-price", response_model=BarrierPriceResponse)
def barrier_price(req: BarrierPriceRequest) -> BarrierPriceResponse:
    opt = req.option_type.value
    vanilla = black_scholes.price(req.S, req.K, req.T, req.r, req.sigma, opt, req.q)
    mc = barrier.price_barrier_mc(
        req.S, req.K, req.T, req.r, req.sigma, opt,
        req.barrier, req.barrier_type.value,
        q=req.q, n_paths=req.n_paths, n_steps=req.n_steps, n_sample_paths=req.n_sample_paths,
    )
    return BarrierPriceResponse(
        vanilla_price=round(vanilla, 6),
        sample_paths=[SamplePath(**p) for p in mc.pop("sample_paths")],
        **mc,
    )


@app.get("/api/spot/{ticker}")
def spot_price(ticker: str) -> dict:
    from app import market_data

    try:
        spot = market_data.get_spot_price(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch spot: {exc}") from exc
    return {"ticker": ticker.upper().strip(), "spot": round(spot, 4)}


@app.get("/api/dividends/{ticker}")
def dividends(ticker: str, horizon: float = 1.0) -> list[dict]:
    from app import market_data
    from datetime import date as _date, timedelta

    try:
        t = market_data._ticker(ticker)
        today = _date.today()
        end = today + timedelta(days=int(horizon * 365.25))
        return market_data.project_dividends(t, today, end)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/market-smile", response_model=MarketSmileResponse)
def market_smile(req: MarketSmileRequest) -> MarketSmileResponse:
    from app import market_data

    try:
        chain = market_data.get_option_chain(req.ticker, req.expiry)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data from Yahoo Finance: {exc}") from exc

    spot = chain["spot"]
    T = chain["expiry_T"]
    calls_by_strike = {c["strike"]: c for c in chain["calls"]}
    puts_by_strike = {p["strike"]: p for p in chain["puts"]}
    all_strikes = sorted(set(calls_by_strike) | set(puts_by_strike))

    points: list[MarketSmilePoint] = []
    for K in all_strikes:
        if K <= spot:
            row = puts_by_strike.get(K)
            option_type = "put"
        else:
            row = calls_by_strike.get(K)
            option_type = "call"

        if row is None or row["mid"] <= 0 or row["openInterest"] < req.min_open_interest:
            continue

        intrinsic = max(spot - K, 0.0) if option_type == "call" else max(K - spot, 0.0)
        disc_intrinsic = intrinsic * np.exp(-req.r * T)
        if row["mid"] < disc_intrinsic:
            continue

        iv = black_scholes.implied_vol(row["mid"], spot, K, T, req.r, option_type, req.q)
        if iv < 0.001 or iv > 5.0:
            continue

        points.append(MarketSmilePoint(
            strike=round(K, 4),
            moneyness=round(float(np.log(K / spot)), 6),
            implied_vol=round(iv, 6),
            mid_price=round(row["mid"], 4),
            bid=round(row["bid"], 4),
            ask=round(row["ask"], 4),
            open_interest=row["openInterest"],
            option_type=option_type,
        ))

    divs = chain["discrete_dividends"]
    if req.dividend_horizon_years is not None:
        from datetime import date as _date, timedelta
        today = _date.today()
        horizon = today + timedelta(days=int(req.dividend_horizon_years * 365.25))
        divs = market_data.project_dividends(market_data._ticker(req.ticker), today, horizon)

    return MarketSmileResponse(
        ticker=req.ticker.upper().strip(),
        spot=round(spot, 4),
        dividend_yield=round(chain["dividend_yield"], 6),
        expiry=chain["expiry"],
        expiry_T=round(T, 6),
        points=points,
        available_expiries=chain["available_expiries"],
        discrete_dividends=divs,
    )


@app.post("/api/portfolio/greeks", response_model=PortfolioGreeksResponse)
def portfolio_greeks(req: PortfolioGreeksRequest) -> PortfolioGreeksResponse:
    pos_results = []
    for pos in req.positions:
        opt = pos.option_type.value
        divs = [(d.t, d.D) for d in pos.discrete_dividends]
        p = black_scholes.price(pos.S, pos.K, pos.T, pos.r, pos.sigma, opt, pos.q, divs)
        g = black_scholes.greeks(pos.S, pos.K, pos.T, pos.r, pos.sigma, opt, pos.q, divs)
        q = pos.quantity
        pos_results.append(PortfolioPositionGreeks(
            ticker=pos.ticker,
            option_type=opt,
            S=pos.S,
            K=pos.K,
            quantity=q,
            price=round(p, 6),
            position_value=round(q * p, 4),
            delta=round(g["delta"], 6),
            gamma=round(g["gamma"], 6),
            vega=round(g["vega"], 6),
            theta=round(g["theta"], 6),
            rho=round(g["rho"], 6),
            dollar_delta=round(q * g["delta"] * pos.S, 2),
            dollar_gamma=round(q * g["gamma"] * pos.S ** 2 / 100, 2),
            dollar_vega=round(q * g["vega"], 4),
            dollar_theta=round(q * g["theta"], 4),
            dollar_rho=round(q * g["rho"], 4),
        ))

    return PortfolioGreeksResponse(
        positions=pos_results,
        net_dollar_delta=round(sum(p.dollar_delta for p in pos_results), 2),
        net_dollar_gamma=round(sum(p.dollar_gamma for p in pos_results), 2),
        net_dollar_vega=round(sum(p.dollar_vega for p in pos_results), 4),
        net_dollar_theta=round(sum(p.dollar_theta for p in pos_results), 4),
        net_dollar_rho=round(sum(p.dollar_rho for p in pos_results), 4),
        net_position_value=round(sum(p.position_value for p in pos_results), 4),
    )


@app.post("/api/portfolio/pnl-heatmap", response_model=PortfolioPnLHeatmapResponse)
def portfolio_pnl_heatmap(req: PortfolioPnLHeatmapRequest) -> PortfolioPnLHeatmapResponse:
    positions = req.positions
    current_value = 0.0
    for pos in positions:
        opt = pos.option_type.value
        divs = [(d.t, d.D) for d in pos.discrete_dividends]
        current_value += pos.quantity * black_scholes.price(
            pos.S, pos.K, pos.T, pos.r, pos.sigma, opt, pos.q, divs
        )

    spot_shocks = np.linspace(-req.spot_shock_range_pct, req.spot_shock_range_pct, req.grid_size).tolist()
    vol_shocks = np.linspace(-req.vol_shock_range_pct, 2 * req.vol_shock_range_pct, req.grid_size).tolist()

    pnl: list[list[float]] = []
    for vs in vol_shocks:
        row = []
        for ss in spot_shocks:
            shocked_value = 0.0
            for pos in positions:
                opt = pos.option_type.value
                divs = [(d.t, d.D) for d in pos.discrete_dividends]
                shocked_S = pos.S * (1 + ss)
                shocked_sigma = max(0.01, pos.sigma * (1 + vs))
                shocked_value += pos.quantity * black_scholes.price(
                    shocked_S, pos.K, pos.T, pos.r, shocked_sigma, opt, pos.q, divs
                )
            row.append(round(shocked_value - current_value, 4))
        pnl.append(row)

    return PortfolioPnLHeatmapResponse(
        spot_shocks=[round(s, 6) for s in spot_shocks],
        vol_shocks=[round(v, 6) for v in vol_shocks],
        pnl=pnl,
        current_portfolio_value=round(current_value, 4),
    )


# AWS Lambda entrypoint via Mangum (unused when running locally with uvicorn)
from mangum import Mangum  # noqa: E402

handler = Mangum(app)
