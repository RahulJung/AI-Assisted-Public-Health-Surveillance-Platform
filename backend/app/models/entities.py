from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    facility_type: Mapped[str] = mapped_column(String(80), default="Emergency Department")
    size: Mapped[str] = mapped_column(String(40), default="medium")
    baseline_volume: Mapped[int] = mapped_column(Integer, default=120)


class SyntheticHL7Message(Base):
    __tablename__ = "synthetic_hl7_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message_control_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    event_message_id: Mapped[str] = mapped_column(String(80), index=True, default="")
    raw_message: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    encounter_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    parsed_status: Mapped[str] = mapped_column(String(40), default="pending")
    data_quality_flags: Mapped[list] = mapped_column(JSON, default=list)


class ParsedEncounter(Base):
    __tablename__ = "parsed_encounters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("synthetic_hl7_messages.id"))
    encounter_date: Mapped[date] = mapped_column(Date, index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    facility: Mapped[str] = mapped_column(String(120), index=True)
    syndrome: Mapped[str] = mapped_column(String(80), index=True)
    age_group: Mapped[str] = mapped_column(String(40), index=True)
    chief_complaint: Mapped[str] = mapped_column(Text)
    diagnosis_code: Mapped[str] = mapped_column(String(40))
    test_result: Mapped[str] = mapped_column(String(40))
    hospitalized: Mapped[bool] = mapped_column(default=False)
    death: Mapped[bool] = mapped_column(default=False)
    report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    parsed_payload: Mapped[dict] = mapped_column(JSON)

    message = relationship("SyntheticHL7Message")


class SurveillanceMetric(Base):
    __tablename__ = "surveillance_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    facility: Mapped[str] = mapped_column(String(120), index=True)
    syndrome: Mapped[str] = mapped_column(String(80), index=True)
    age_group: Mapped[str] = mapped_column(String(40), index=True)
    ed_visits: Mapped[int] = mapped_column(Integer)
    test_positivity: Mapped[float] = mapped_column(Float)
    hospitalizations: Mapped[int] = mapped_column(Integer)
    deaths: Mapped[int] = mapped_column(Integer)
    reporting_delay_days: Mapped[float] = mapped_column(Float, default=0)
    data_quality_score: Mapped[float] = mapped_column(Float, default=1)
    data_quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    scenario: Mapped[str] = mapped_column(String(120), default="baseline")


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    facility: Mapped[str] = mapped_column(String(120), index=True)
    syndrome: Mapped[str] = mapped_column(String(80), index=True)
    age_group: Mapped[str] = mapped_column(String(40), index=True)
    anomaly_score: Mapped[float] = mapped_column(Float)
    severity_score: Mapped[float] = mapped_column(Float, default=0)
    severity: Mapped[str] = mapped_column(String(40), index=True)
    models_flagged: Mapped[list] = mapped_column(JSON)
    model_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    signal_type: Mapped[str] = mapped_column(String(80), default="undetermined")
    explanation: Mapped[str] = mapped_column(Text)


class RagDocument(Base):
    __tablename__ = "rag_documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    content: Mapped[str] = mapped_column(Text)


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    title: Mapped[str] = mapped_column(String(180))
    markdown: Mapped[str] = mapped_column(Text)
