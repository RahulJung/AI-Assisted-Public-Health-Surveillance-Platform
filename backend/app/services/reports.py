from sqlalchemy.orm import Session

from app.models.entities import AnomalyResult, GeneratedReport
from app.services.synthetic_data import display_region, display_region_text


def generate_insight(anomaly: AnomalyResult | None) -> dict:
    if anomaly is None:
        return {"message": "No anomaly selected. Run detection first."}
    metrics = anomaly.model_metrics or {}
    return {
        "what_changed": f"{anomaly.syndrome} ED activity exceeded expected baseline with an anomaly score of {anomaly.anomaly_score}.",
        "where": f"{display_region(anomaly.region)}, {anomaly.facility}",
        "when": anomaly.metric_date.isoformat(),
        "syndrome": anomaly.syndrome,
        "age_group": anomaly.age_group,
        "contributing_facilities": [anomaly.facility],
        "contributing_regions": [display_region(anomaly.region)],
        "baseline_comparison": display_region_text(anomaly.explanation),
        "positivity_lead": "Yes" if metrics.get("test_positivity_pct_change", 0) > 0.2 else "No clear lead signal",
        "hospitalization_lag": "Yes" if metrics.get("hospitalization_pct_change", 0) > 0.4 else "No clear lag signal",
        "likely_signal_type": anomaly.signal_type,
        "severity_score": anomaly.severity_score,
        "model_metrics": metrics,
        "models_flagged": anomaly.models_flagged,
        "follow_up": [
            "Validate message volume and reporting delay.",
            "Compare early indicators with severity indicators.",
            "Review chief complaints and diagnosis-code mix.",
            "Check whether data quality flags suggest delayed batch upload, duplicates, or missing fields.",
            "Document findings in an investigation brief.",
        ],
    }


def generate_report(db: Session) -> dict:
    anomaly = db.query(AnomalyResult).order_by(AnomalyResult.anomaly_score.desc()).first()
    insight = generate_insight(anomaly)
    title = "Synthetic Public Health Surveillance Investigation Brief"
    markdown = f"""# {title}

## Executive Summary
This independent research prototype detected an unusual synthetic surveillance signal for {getattr(anomaly, "syndrome", "selected syndrome")} activity. The signal should be reviewed as decision support only.

## Signal Description
{display_region_text(getattr(anomaly, "explanation", "No anomaly has been generated yet."))}

Likely signal type: {getattr(anomaly, "signal_type", "not available")}. Severity score: {getattr(anomaly, "severity_score", "not available")}.

## Surveillance Indicators
- Early indicators: ED visits and test positivity.
- Severity indicators: hospitalizations and deaths.
- Additional indicators: syndrome trends, region changes, facility spikes, age-group distribution, reporting delays, and data quality score.

## ML Methods
- Rolling baseline z-score for recent deviation from expected activity.
- Isolation Forest for multivariate outlier detection.
- DBSCAN for regional and facility-level outlier clustering.
- EWMA for trend acceleration.

## RAG-Supported Context
Analysts should compare the synthetic signal with public health surveillance guidance about reporting delays, facility-level artifacts, syndrome definitions, and indicator triangulation.

## Key Findings
- Location: {insight.get("where", "Not available")}
- Date: {insight.get("when", "Not available")}
- Age group: {insight.get("age_group", "Not available")}
- Likely signal type: {insight.get("likely_signal_type", "Not available")}
- Models flagged: {", ".join(insight.get("models_flagged", []))}

## Recommended Follow-Up
- Validate data completeness and duplicate message counts.
- Compare test positivity with ED visits and later severity indicators.
- Review facility contribution and age-group patterns.
- Escalate only after technical artifacts are reasonably excluded.

## Limitations
All records, HL7 messages, indicators, and anomalies are synthetic. Model outputs are illustrative and not validated for operational public health use.

## Research Disclaimer
This is an independent research prototype. It does not use real patient data, does not connect to confidential systems, and should not be used for clinical or public health decision-making.
"""
    report = GeneratedReport(title=title, markdown=markdown)
    db.add(report)
    db.commit()
    return {"title": title, "markdown": markdown}
