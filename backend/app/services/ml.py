import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.models.entities import AnomalyResult
from app.services.synthetic_data import metrics_dataframe


def severity_from_score(score: float) -> str:
    if score >= 12:
        return "Critical"
    if score >= 8:
        return "High"
    if score >= 4.5:
        return "Moderate"
    return "Low"


def likely_signal_type(row) -> str:
    flags = row.data_quality_flags if isinstance(row.data_quality_flags, list) else []
    if "facility_batch_upload" in flags or (row.reporting_delay_days >= 3 and row.data_quality_score < 0.8):
        return "reporting artifact"
    if row.test_positivity_pct_change > 0.25 and row.hosp_pct_change >= 0:
        return "likely true outbreak"
    if row.hospitalizations >= max(2, row.hosp_rolling_14 * 1.5):
        return "severity signal"
    return "undetermined signal"


def run_detection(db: Session) -> list[dict]:
    df = metrics_dataframe(db)
    if df.empty:
        return []
    df["date"] = pd.to_datetime(df["date"])
    df["day_of_week"] = df["date"].dt.dayofweek
    df["quality_flag_count"] = df["data_quality_flags"].apply(len)

    grouped = (
        df.groupby(["date", "region", "facility", "syndrome", "age_group"], as_index=False)
        .agg(
            ed_visits=("ed_visits", "sum"),
            test_positivity=("test_positivity", "mean"),
            hospitalizations=("hospitalizations", "sum"),
            deaths=("deaths", "sum"),
            reporting_delay_days=("reporting_delay_days", "mean"),
            data_quality_score=("data_quality_score", "mean"),
            quality_flag_count=("quality_flag_count", "sum"),
            scenario=("scenario", lambda values: next((value for value in values if value != "baseline"), "baseline")),
            data_quality_flags=("data_quality_flags", lambda values: sorted({flag for flags in values for flag in flags})),
            day_of_week=("day_of_week", "first"),
        )
        .sort_values(["region", "facility", "syndrome", "age_group", "date"])
    )

    keys = ["region", "facility", "syndrome", "age_group"]
    grouped["rolling_7"] = grouped.groupby(keys)["ed_visits"].transform(lambda s: s.shift(1).rolling(7, min_periods=4).mean())
    grouped["rolling_14"] = grouped.groupby(keys)["ed_visits"].transform(lambda s: s.shift(1).rolling(14, min_periods=7).mean())
    grouped["std_7"] = grouped.groupby(keys)["ed_visits"].transform(lambda s: s.shift(1).rolling(7, min_periods=4).std())
    grouped["std_14"] = grouped.groupby(keys)["ed_visits"].transform(lambda s: s.shift(1).rolling(14, min_periods=7).std())
    grouped["z_score_7"] = ((grouped["ed_visits"] - grouped["rolling_7"]) / grouped["std_7"].replace(0, np.nan)).fillna(0)
    grouped["z_score_14"] = ((grouped["ed_visits"] - grouped["rolling_14"]) / grouped["std_14"].replace(0, np.nan)).fillna(0)
    grouped["rolling_average"] = grouped["rolling_14"].fillna(grouped["rolling_7"]).fillna(grouped["ed_visits"])
    grouped["percent_change"] = ((grouped["ed_visits"] - grouped["rolling_average"]) / grouped["rolling_average"].replace(0, np.nan)).fillna(0)
    grouped["hosp_rolling_14"] = grouped.groupby(keys)["hospitalizations"].transform(lambda s: s.shift(1).rolling(14, min_periods=7).mean()).fillna(0)
    grouped["hosp_pct_change"] = ((grouped["hospitalizations"] - grouped["hosp_rolling_14"]) / grouped["hosp_rolling_14"].replace(0, np.nan)).fillna(0)
    grouped["death_rolling_14"] = grouped.groupby(keys)["deaths"].transform(lambda s: s.shift(1).rolling(14, min_periods=7).mean()).fillna(0)
    grouped["death_pct_change"] = ((grouped["deaths"] - grouped["death_rolling_14"]) / grouped["death_rolling_14"].replace(0, np.nan)).fillna(0)
    grouped["positivity_rolling_7"] = grouped.groupby(keys)["test_positivity"].transform(lambda s: s.shift(1).rolling(7, min_periods=4).mean()).fillna(grouped["test_positivity"])
    grouped["test_positivity_pct_change"] = ((grouped["test_positivity"] - grouped["positivity_rolling_7"]) / grouped["positivity_rolling_7"].replace(0, np.nan)).fillna(0)
    grouped["ewma"] = grouped.groupby(keys)["ed_visits"].transform(lambda s: s.ewm(span=7, adjust=False).mean())
    grouped["ewma_delta"] = grouped.groupby(keys)["ewma"].diff().fillna(0)

    model_features = grouped[
        [
            "ed_visits",
            "test_positivity",
            "hospitalizations",
            "deaths",
            "reporting_delay_days",
            "data_quality_score",
            "day_of_week",
            "rolling_average",
            "percent_change",
            "z_score_7",
            "z_score_14",
            "ewma_delta",
            "quality_flag_count",
        ]
    ].copy()
    categorical = pd.get_dummies(grouped[["region", "facility", "syndrome", "age_group"]], dtype=float)
    model_matrix = pd.concat([model_features, categorical], axis=1).replace([np.inf, -np.inf], 0).fillna(0)
    scaled = StandardScaler().fit_transform(model_matrix)

    iso = IsolationForest(contamination=0.035, random_state=42)
    grouped["isolation_prediction"] = iso.fit_predict(scaled)
    grouped["isolation_score"] = -iso.score_samples(scaled)
    grouped["isolation_flag"] = grouped["isolation_prediction"] == -1

    cluster_features = grouped[["ed_visits", "test_positivity", "hospitalizations", "reporting_delay_days", "percent_change", "z_score_14"]]
    grouped["dbscan_cluster"] = DBSCAN(eps=0.95, min_samples=10).fit_predict(StandardScaler().fit_transform(cluster_features.fillna(0)))
    grouped["dbscan_flag"] = grouped["dbscan_cluster"] == -1
    grouped["z_flag"] = grouped[["z_score_7", "z_score_14"]].max(axis=1) >= 2.4
    grouped["ewma_flag"] = grouped["ewma_delta"] >= grouped["ewma_delta"].quantile(0.975)
    grouped["positivity_lead_signal"] = grouped["test_positivity_pct_change"] > 0.22
    grouped["hospitalization_lag_signal"] = grouped["hosp_pct_change"] > 0.4

    affected = grouped.groupby(["date", "region", "syndrome"], as_index=False).agg(
        affected_facilities=("facility", "nunique"),
        affected_age_groups=("age_group", "nunique"),
    )
    grouped = grouped.merge(affected, on=["date", "region", "syndrome"], how="left")
    grouped["model_agreement"] = grouped[["z_flag", "isolation_flag", "dbscan_flag", "ewma_flag"]].sum(axis=1)
    grouped["anomaly_score"] = (
        grouped[["z_score_7", "z_score_14"]].max(axis=1).clip(lower=0) * 1.25
        + grouped["isolation_flag"].astype(int) * 2.0
        + grouped["dbscan_flag"].astype(int) * 1.2
        + grouped["ewma_flag"].astype(int) * 1.6
        + grouped["positivity_lead_signal"].astype(int) * 0.9
        + grouped["hospitalization_lag_signal"].astype(int) * 1.3
        + grouped["affected_facilities"].clip(upper=8) * 0.18
        + grouped["affected_age_groups"].clip(upper=5) * 0.22
        + grouped["deaths"].clip(upper=5) * 0.45
        - grouped["quality_flag_count"].clip(upper=4) * 0.25
    )
    flagged = grouped[
        grouped[["z_flag", "isolation_flag", "dbscan_flag", "ewma_flag", "positivity_lead_signal", "hospitalization_lag_signal"]].any(axis=1)
    ].copy()
    flagged = flagged.sort_values(["anomaly_score", "date"], ascending=[False, False]).head(100)

    db.query(AnomalyResult).delete()
    db.flush()
    results = []
    for row in flagged.itertuples():
        models = []
        if row.z_flag:
            models.append("Rolling 7/14-day z-score")
        if row.ewma_flag:
            models.append("EWMA acceleration")
        if row.isolation_flag:
            models.append("Isolation Forest")
        if row.dbscan_flag:
            models.append("DBSCAN cluster/outlier")
        if row.positivity_lead_signal:
            models.append("test positivity lead indicator")
        if row.hospitalization_lag_signal:
            models.append("hospitalization lag indicator")

        signal_type = likely_signal_type(row)
        severity_score = float(row.anomaly_score + row.model_agreement * 0.8 + max(0, row.hosp_pct_change) * 0.6 + max(0, row.death_pct_change) * 0.8)
        severity = severity_from_score(severity_score)
        explanation = (
            f"{row.syndrome} activity in {row.region} at {row.facility} for age group {row.age_group} changed on {row.date.date().isoformat()}. "
            f"Observed ED visits were {row.ed_visits} versus a 14-day baseline of {row.rolling_14:.1f} "
            f"(z14={row.z_score_14:.2f}, pct_change={row.percent_change:.0%}). "
            f"Test positivity change was {row.test_positivity_pct_change:.0%}; hospitalization change was {row.hosp_pct_change:.0%}. "
            f"Likely signal type: {signal_type}. Models: {', '.join(models)}."
        )
        item = AnomalyResult(
            metric_date=row.date.date(),
            region=row.region,
            facility=row.facility,
            syndrome=row.syndrome,
            age_group=row.age_group,
            anomaly_score=round(float(row.anomaly_score), 2),
            severity_score=round(severity_score, 2),
            severity=severity,
            models_flagged=models,
            model_metrics={
                "z_score_7": round(float(row.z_score_7), 2),
                "z_score_14": round(float(row.z_score_14), 2),
                "isolation_score": round(float(row.isolation_score), 3),
                "ewma_delta": round(float(row.ewma_delta), 2),
                "dbscan_cluster": int(row.dbscan_cluster),
                "model_agreement": int(row.model_agreement),
                "affected_facilities": int(row.affected_facilities),
                "affected_age_groups": int(row.affected_age_groups),
                "percent_change": round(float(row.percent_change), 3),
                "test_positivity_pct_change": round(float(row.test_positivity_pct_change), 3),
                "hospitalization_pct_change": round(float(row.hosp_pct_change), 3),
                "death_pct_change": round(float(row.death_pct_change), 3),
                "data_quality_flags": row.data_quality_flags,
                "scenario": row.scenario,
            },
            signal_type=signal_type,
            explanation=explanation,
        )
        db.add(item)
        results.append(item)
    db.commit()
    return serialize_anomalies(results)


def serialize_anomalies(rows: list[AnomalyResult]) -> list[dict]:
    return [
        {
            "id": row.id,
            "metric_date": row.metric_date.isoformat(),
            "region": row.region,
            "facility": row.facility,
            "syndrome": row.syndrome,
            "age_group": row.age_group,
            "anomaly_score": row.anomaly_score,
            "severity_score": row.severity_score,
            "severity": row.severity,
            "models_flagged": row.models_flagged,
            "model_metrics": row.model_metrics or {},
            "signal_type": row.signal_type,
            "explanation": row.explanation,
        }
        for row in rows
    ]


def forecast(db: Session, syndrome: str = "Respiratory", days: int = 14) -> dict:
    df = metrics_dataframe(db)
    if df.empty:
        return {"syndrome": syndrome, "forecast": []}
    daily = df[df["syndrome"] == syndrome].groupby("date", as_index=False)["ed_visits"].sum().sort_values("date")
    daily["moving_average"] = daily["ed_visits"].rolling(14, min_periods=7).mean()
    baseline = daily["moving_average"].iloc[-1] if not np.isnan(daily["moving_average"].iloc[-1]) else daily["ed_visits"].mean()
    trend = daily["moving_average"].diff().tail(14).mean()
    std = daily["ed_visits"].tail(28).std()
    last_date = pd.to_datetime(daily["date"].iloc[-1])
    points = []
    for step in range(1, days + 1):
        pred = max(0, baseline + trend * step)
        interval_width = (1.05 if step <= 7 else 1.45) * std
        points.append(
            {
                "date": (last_date + pd.Timedelta(days=step)).date().isoformat(),
                "horizon": "7-day" if step <= 7 else "14-day",
                "predicted_ed_visits": round(float(pred), 1),
                "lower": round(float(max(0, pred - interval_width)), 1),
                "upper": round(float(pred + interval_width), 1),
            }
        )
    direction = "increasing" if trend > 0.5 else "stable" if trend > -0.5 else "decreasing"
    return {
        "syndrome": syndrome,
        "horizon_days": days,
        "method": "14-day moving average forecast with wider uncertainty after day 7",
        "forecast": points,
        "interpretation": f"{syndrome} activity is projected to be {direction} over the next {days} days based on recent synthetic ED visit trends and scenario-driven seasonality.",
    }
