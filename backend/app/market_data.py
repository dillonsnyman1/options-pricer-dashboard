import math
import time
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import yfinance as yf

_cache: Dict[Tuple[str, str], Tuple[float, dict]] = {}
_CACHE_TTL = 60.0


def _ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol.upper().strip())


def get_spot_price(ticker: str) -> float:
    t = _ticker(ticker)
    price = t.fast_info.get("lastPrice") or t.fast_info.get("previousClose")
    if price is None:
        raise ValueError(f"Could not fetch spot price for {ticker!r}")
    return float(price)


def _safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    f = float(val)
    return default if math.isnan(f) else f


def _safe_int(val, default: int = 0) -> int:
    if val is None:
        return default
    f = float(val)
    return default if math.isnan(f) else int(f)


def get_expiry_dates(ticker: str) -> List[str]:
    dates = _ticker(ticker).options
    if not dates:
        raise ValueError(f"No options chain available for {ticker!r}")
    return list(dates)


def project_dividends(t: yf.Ticker, today: date, expiry: date) -> List[dict]:
    try:
        divs = t.dividends
    except Exception:
        return []
    if divs is None or divs.empty:
        return []

    last_amount = float(divs.iloc[-1])
    dates = [d.date() if hasattr(d, "date") else d for d in divs.index]
    if len(dates) < 2:
        return []

    intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
    median_interval = sorted(intervals)[len(intervals) // 2]

    last_ex = dates[-1]
    projected: List[dict] = []
    d = last_ex
    while True:
        d = d + timedelta(days=median_interval)
        if d > expiry:
            break
        if d > today:
            t_years = round((d - today).days / 365.25, 4)
            projected.append({"t": t_years, "D": round(last_amount, 4)})

    return projected


def get_option_chain(ticker: str, expiry: Optional[str] = None) -> dict:
    t = _ticker(ticker)
    available = list(t.options)
    if not available:
        raise ValueError(f"No options chain available for {ticker!r}")

    if expiry is None:
        today = date.today()
        for d in available:
            exp_date = datetime.strptime(d, "%Y-%m-%d").date()
            days_out = (exp_date - today).days
            if 7 <= days_out <= 60:
                expiry = d
                break
        if expiry is None:
            expiry = available[0]

    if expiry not in available:
        raise ValueError(f"Expiry {expiry!r} not available. Options: {available[:10]}")

    cache_key = (ticker.upper().strip(), expiry)
    now = time.time()
    if cache_key in _cache:
        ts, cached = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return cached

    spot = get_spot_price(ticker)
    try:
        div_yield = _safe_float(t.info.get("trailingAnnualDividendYield"))
    except Exception:
        div_yield = 0.0
    chain = t.option_chain(expiry)

    today = date.today()
    exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
    expiry_T = max((exp_date - today).days, 1) / 365.25

    def _extract(df) -> List[dict]:
        rows = []
        for _, row in df.iterrows():
            bid = _safe_float(row.get("bid"))
            ask = _safe_float(row.get("ask"))
            mid = (bid + ask) / 2.0 if bid > 0 and ask > 0 else 0.0
            rows.append({
                "strike": float(row["strike"]),
                "bid": bid,
                "ask": ask,
                "mid": mid,
                "volume": _safe_int(row.get("volume")),
                "openInterest": _safe_int(row.get("openInterest")),
            })
        return rows

    upcoming_divs = project_dividends(t, today, exp_date)

    result = {
        "spot": spot,
        "dividend_yield": div_yield,
        "expiry": expiry,
        "expiry_T": expiry_T,
        "calls": _extract(chain.calls),
        "puts": _extract(chain.puts),
        "available_expiries": available,
        "discrete_dividends": upcoming_divs,
    }

    _cache[cache_key] = (now, result)
    return result
