from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import AnomalyResult, ParsedEncounter, SyntheticHL7Message
from app.services.hl7 import parse_hl7_message
from app.services.ml import forecast, run_detection, serialize_anomalies
from app.services.rag import rag_service
from app.services.reports import generate_insight, generate_report
from app.services.synthetic_data import display_region, ensure_synthetic_data, metrics_dataframe

router = APIRouter(prefix="/api")


class HL7ParseRequest(BaseModel):
    raw_message: str


class RagQuery(BaseModel):
    question: str


class InsightRequest(BaseModel):
    anomaly_id: int | None = None


@router.post("/generate-synthetic-data")
def generate_synthetic_data(force: bool = False, db: Session = Depends(get_db)):
    result = ensure_synthetic_data(db, force=force)
    rag_service.index_documents(db)
    return result


@router.get("/records")
def records(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.query(ParsedEncounter).order_by(ParsedEncounter.encounter_date.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "date": row.encounter_date.isoformat(),
            "region": display_region(row.region),
            "facility": row.facility,
            "syndrome": row.syndrome,
            "age_group": row.age_group,
            "chief_complaint": row.chief_complaint,
            "diagnosis_code": row.diagnosis_code,
            "test_result": row.test_result,
            "report_date": row.report_date.isoformat() if row.report_date else None,
            "data_quality_flags": row.data_quality_flags or [],
        }
        for row in rows
    ]


@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    df = metrics_dataframe(db)
    if df.empty:
        return {"ed_visits": 0, "test_positivity": 0, "hospitalizations": 0, "deaths": 0}
    latest = df[df["date"] >= df["date"].max()]
    return {
        "ed_visits": int(latest["ed_visits"].sum()),
        "test_positivity": round(float(latest["test_positivity"].mean()), 3),
        "hospitalizations": int(latest["hospitalizations"].sum()),
        "deaths": int(latest["deaths"].sum()),
        "active_regions": int(df["region"].nunique()),
        "facilities": int(df["facility"].nunique()),
    }


@router.get("/dashboard/trends")
def dashboard_trends(region: str | None = None, facility: str | None = None, syndrome: str | None = None, age_group: str | None = None, db: Session = Depends(get_db)):
    df = metrics_dataframe(db)
    if df.empty:
        return {"trends": [], "regional": [], "facilities": [], "age_groups": []}
    for column, value in [("region", region), ("facility", facility), ("syndrome", syndrome), ("age_group", age_group)]:
        if value:
            df = df[df[column] == value]
    trends = df.groupby("date", as_index=False).agg(ed_visits=("ed_visits", "sum"), test_positivity=("test_positivity", "mean"), hospitalizations=("hospitalizations", "sum"), deaths=("deaths", "sum"))
    syndrome_rows = df.groupby(["date", "syndrome"], as_index=False)["ed_visits"].sum()
    return {
        "trends": [{**row, "date": row["date"].isoformat()} for row in trends.tail(90).to_dict("records")],
        "syndromes": [{**row, "date": row["date"].isoformat()} for row in syndrome_rows.tail(400).to_dict("records")],
        "regional": df.groupby("region", as_index=False)["ed_visits"].sum().to_dict("records"),
        "facilities": df.groupby("facility", as_index=False)["ed_visits"].sum().sort_values("ed_visits", ascending=False).head(10).to_dict("records"),
        "age_groups": df.groupby("age_group", as_index=False)["ed_visits"].sum().to_dict("records"),
    }


@router.get("/hl7/messages")
def hl7_messages(limit: int = 20, db: Session = Depends(get_db)):
    rows = db.query(SyntheticHL7Message).order_by(SyntheticHL7Message.id.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "message_control_id": row.message_control_id,
            "event_message_id": row.event_message_id,
            "raw_message": row.raw_message,
            "encounter_date": row.encounter_date.isoformat() if row.encounter_date else None,
            "report_date": row.report_date.isoformat() if row.report_date else None,
            "parsed_status": row.parsed_status,
            "data_quality_flags": row.data_quality_flags or [],
        }
        for row in rows
    ]


@router.post("/hl7/parse")
def parse_hl7(payload: HL7ParseRequest):
    return parse_hl7_message(payload.raw_message)


@router.post("/ml/run-detection")
def ml_run_detection(db: Session = Depends(get_db)):
    return run_detection(db)


@router.get("/ml/anomalies")
def ml_anomalies(db: Session = Depends(get_db)):
    rows = db.query(AnomalyResult).order_by(AnomalyResult.anomaly_score.desc()).limit(100).all()
    return serialize_anomalies(rows)


@router.get("/ml/forecast")
def ml_forecast(syndrome: str = "Respiratory", days: int = 14, db: Session = Depends(get_db)):
    return forecast(db, syndrome=syndrome, days=days)


@router.post("/rag/query")
def rag_query(payload: RagQuery, db: Session = Depends(get_db)):
    return rag_service.query(payload.question, db)


@router.post("/rag/reindex")
def rag_reindex(db: Session = Depends(get_db)):
    return rag_service.index_documents(db)


@router.get("/rag/status")
def rag_status():
    return {
        "provider": rag_service.provider,
        "openai_configured": bool(rag_service.openai_client),
        "embedding_model": rag_service.embedding_model_name,
        "generation_model": rag_service.generation_model_name(),
    }


@router.post("/insights/generate")
def insights_generate(payload: InsightRequest, db: Session = Depends(get_db)):
    query = db.query(AnomalyResult)
    anomaly = query.filter(AnomalyResult.id == payload.anomaly_id).first() if payload.anomaly_id else query.order_by(AnomalyResult.anomaly_score.desc()).first()
    insight = generate_insight(anomaly)
    if anomaly:
        rag_question = (
            f"How should an analyst interpret a {anomaly.syndrome} anomaly in {anomaly.region} "
            f"with signal type {anomaly.signal_type}, test positivity and hospitalization lag evidence?"
        )
        insight["rag_context"] = rag_service.query(
            rag_question,
            db,
            n_results=3,
            anomaly_context={
                "syndrome": anomaly.syndrome,
                "region": anomaly.region,
                "facility": anomaly.facility,
                "age_group": anomaly.age_group,
                "severity": anomaly.severity,
                "signal_type": anomaly.signal_type,
                "model_metrics": anomaly.model_metrics or {},
            },
        )
    return insight


@router.post("/reports/generate")
def reports_generate(db: Session = Depends(get_db)):
    return generate_report(db)
