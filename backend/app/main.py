from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import entities  # noqa: F401

Base.metadata.create_all(bind=engine)


def ensure_sqlite_columns():
    if engine.url.get_backend_name() != "sqlite":
        return
    column_specs = {
        "facilities": {"size": "VARCHAR(40) DEFAULT 'medium'", "baseline_volume": "INTEGER DEFAULT 120"},
        "synthetic_hl7_messages": {
            "event_message_id": "VARCHAR(80) DEFAULT ''",
            "encounter_date": "DATE",
            "report_date": "DATE",
            "data_quality_flags": "JSON DEFAULT '[]'",
        },
        "parsed_encounters": {"report_date": "DATE", "data_quality_flags": "JSON DEFAULT '[]'"},
        "surveillance_metrics": {"data_quality_flags": "JSON DEFAULT '[]'", "scenario": "VARCHAR(120) DEFAULT 'baseline'"},
        "anomaly_results": {
            "severity_score": "FLOAT DEFAULT 0",
            "model_metrics": "JSON DEFAULT '{}'",
            "signal_type": "VARCHAR(80) DEFAULT 'undetermined'",
        },
    }
    with engine.begin() as connection:
        for table, specs in column_specs.items():
            existing = {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table})")}
            for column, definition in specs.items():
                if column not in existing:
                    connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


ensure_sqlite_columns()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
