import pandas as pd
try:
    from prophet import Prophet
except (ImportError, ModuleNotFoundError):
    Prophet = None

MIN_HISTORY_POINTS = 10
MOVING_AVERAGE_WINDOW = 7


class InsufficientHistoryError(Exception):
    pass


def _build_series(history):
    """Aggregates same-day entries and returns a Prophet-ready (ds, y) DataFrame, sorted."""
    df = pd.DataFrame(history)
    df['date'] = pd.to_datetime(df['date'])
    df = df.groupby('date', as_index=False)['amount'].sum()
    df = df.sort_values('date').rename(columns={'date': 'ds', 'amount': 'y'})
    return df


def _moving_average_baseline(df, horizon_days):
    window = df['y'].tail(MOVING_AVERAGE_WINDOW)
    baseline_value = float(window.mean()) if len(window) else 0.0
    last_date = df['ds'].max()
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=horizon_days)
    return [
        {'date': d.strftime('%Y-%m-%d'), 'amount': baseline_value}
        for d in future_dates
    ]


def forecast_cashflow(history, horizon_days=30):
    """Fits Prophet on a submitted cash-flow history and forecasts `horizon_days` ahead.

    `history` is a list of {"date": "YYYY-MM-DD", "amount": number}. Returns a dict with
    the forecast series (with confidence interval), a moving-average baseline for the same
    horizon, and an explicit indicative-only flag, per the proposal's transparency principle
    (section 7.2: no financial decision should be automated on this basis alone).
    """
    if len(history) < MIN_HISTORY_POINTS:
        raise InsufficientHistoryError(
            f'At least {MIN_HISTORY_POINTS} historical data points are required, got {len(history)}'
        )

    df = _build_series(history)

    if Prophet is None:
        baseline = _moving_average_baseline(df, horizon_days)
        forecast_series = [
            {'date': b['date'], 'yhat': b['amount'], 'yhat_lower': b['amount'], 'yhat_upper': b['amount']}
            for b in baseline
        ]
        return {
            'forecast': forecast_series,
            'baseline': baseline,
            'interval_width': 0.8,
            'indicative_only': True,
        }

    model = Prophet(interval_width=0.8)
    model.fit(df)

    future = model.make_future_dataframe(periods=horizon_days)
    prediction = model.predict(future)
    future_only = prediction.tail(horizon_days)

    forecast_series = [
        {
            'date': row.ds.strftime('%Y-%m-%d'),
            'yhat': round(row.yhat, 2),
            'yhat_lower': round(row.yhat_lower, 2),
            'yhat_upper': round(row.yhat_upper, 2),
        }
        for row in future_only.itertuples()
    ]

    return {
        'forecast': forecast_series,
        'baseline': _moving_average_baseline(df, horizon_days),
        'interval_width': 0.8,
        'indicative_only': True,
    }
