# AI/ML Public Health Surveillance Assistant

Research-grade decision support for syndromic surveillance, anomaly detection, and public health knowledge retrieval. This repository is an independent prototype using synthetic HL7/EHR-style data only.

## Public Health Relevance

The application follows CDC-style surveillance framing:

- Early indicators: emergency department visits and test positivity.
- Severity indicators: hospitalizations and deaths.
- Additional indicators: syndrome trends, regional changes, facility-level spikes, age-group changes, reporting delays, and data quality issues.

The workflow is:

```text
Synthetic HL7/EHR data -> ingestion API -> HL7 parser -> PostgreSQL -> feature engineering -> ML anomaly detection -> RAG knowledge retrieval -> explainable insight generation -> investigation report
```

## Technical Architecture

- Frontend: React, Next.js, TypeScript, TailwindCSS, shadcn-style UI primitives, Recharts.
- Backend: Python FastAPI, SQLAlchemy, Alembic, PostgreSQL.
- AI/ML: pandas, numpy, scikit-learn, Isolation Forest, DBSCAN, rolling baseline z-score, EWMA trend detection, moving-average forecasting.
- RAG: local markdown knowledge base, chunking, ChromaDB vector storage, optional OpenAI embeddings, optional OpenAI response generation, semantic retrieval with snippets and source citations.
- Deployment: Docker and docker-compose.

## Application Pages

- Landing Page
- Surveillance Dashboard
- HL7/EHR Processing
- ML Signal Detection
- Forecasting
- Public Health Knowledge Retrieval Panel
- Explainable AI Insights
- Investigation Brief

## Surveillance Simulation Engine

The backend does not create arbitrary fake rows. It uses a deterministic `SurveillanceSimulationEngine` in `backend/app/services/synthetic_data.py` to model how syndromic surveillance data behaves in practice. The engine generates 180 days of synthetic HL7/EHR-style surveillance data across:

- 5 regions
- 20 facilities
- 8 syndrome categories
- multiple age groups
- ED visits, test positivity, hospitalizations, deaths
- chief complaints and diagnosis codes
- synthetic HL7 ADT-style raw messages

The simulation includes:

- facility-level ED volume patterns with large, medium, and small facilities
- regional variation
- syndrome-specific baselines
- day-of-week effects
- winter-like increases for respiratory and influenza-like illness
- warmer-period increases for heat-related illness
- smaller periodic gastrointestinal fluctuations
- stable injury patterns
- noisier trends in smaller facilities
- reporting delays, missing data, duplicates, facility downtime, batch uploads, and inconsistent labels

Injected scenarios are designed to look like analyst-facing surveillance problems:

- Respiratory outbreak in `Region_3`: test positivity rises first, ED visits rise 2 to 3 days later, hospitalizations rise 5 to 7 days later, deaths rise 10 to 14 days later, with stronger effects in children and older adults.
- Gastrointestinal gradual increase in `Region_1`: slow 14-day ramp concentrated in three facilities and mostly affecting children and young adults.
- Facility-level reporting artifact at `Facility_12`: missing/delayed reporting for several days followed by a sudden catch-up batch upload.
- Older-adult respiratory severity signal in `Region_4`: ED visits rise moderately while hospitalization ratio rises more sharply.

Data quality flags are stored on metrics, messages, and parsed encounters:

- `missing_chief_complaint`
- `missing_diagnosis`
- `duplicate_message`
- `delayed_report`
- `facility_batch_upload`
- `inconsistent_label`

## AI/ML Methods

The ML layer is central to the project and runs on engineered surveillance features:

- Rolling baseline z-score: compares observed ED visits with shifted 7-day and 14-day baselines.
- EWMA trend acceleration: detects gradual increases that may not appear as sudden spikes.
- Isolation Forest: uses visit count, test positivity, hospitalizations, deaths, region, facility, syndrome, age group, day of week, rolling average, percent change, reporting delay, and data quality score.
- DBSCAN: identifies abnormal regional/facility clusters and outlier points.
- Forecasting: predicts next 7 and 14 days with moving-average forecasts and uncertainty bands.

Every anomaly includes explainable model evidence:

- z-score values
- Isolation Forest score
- EWMA delta
- DBSCAN cluster label
- model agreement count
- affected facilities and age groups
- test positivity lead signal
- hospitalization and death lag signals
- likely signal type: true outbreak, reporting artifact, severity signal, or undetermined
- severity level based on score, model agreement, affected strata, hospitalization increase, death increase, and data quality context

## RAG Pipeline

Markdown files live in `backend/knowledge_base` and cover:

- syndromic surveillance
- COVID surveillance indicators
- HL7 ADT messages
- ED visit trends
- test positivity
- hospitalization lag
- death lag
- chief complaint analysis
- anomaly investigation
- reporting delays
- facility-level spikes
- data quality problems
- explainable AI in public health
- public health analyst workflow

The `/api/rag/query` endpoint supports analyst interpretation rather than generic chat. It returns:

- concise answer
- retrieved supporting snippets
- cited source documents
- recommended investigation checklist
- related indicators to review

### OpenAI RAG Mode

By default the app can run locally. To use OpenAI for RAG:

```bash
cd backend
cp .env.example .env
export OPENAI_API_KEY=...
export RAG_PROVIDER=openai
export OPENAI_EMBEDDING_MODEL=text-embedding-3-small
export OPENAI_RAG_MODEL=gpt-4o-mini
uvicorn app.main:app --reload
```

Then rebuild the vector index:

```bash
curl -X POST http://localhost:8000/api/rag/reindex
curl http://localhost:8000/api/rag/status
```

In OpenAI mode:

- document chunks are embedded with `OPENAI_EMBEDDING_MODEL`
- retrieved snippets are still stored in ChromaDB
- answer synthesis uses `OPENAI_RAG_MODEL` or `OPENAI_FINE_TUNED_MODEL`
- the UI remains a Public Health Knowledge Retrieval Panel, not a chatbot

### Fine-Tuning

Fine-tuning is not the same as RAG indexing. The knowledge base is retrieved at query time; the fine-tuned model controls response style, structure, caution language, and analyst workflow.

Starter files live in `backend/training`:

- `rag_finetune_examples.jsonl`
- `README.md`

Create a fine-tuning job:

```bash
cd backend
export OPENAI_API_KEY=...
export OPENAI_FINE_TUNE_BASE_MODEL=gpt-4o-mini
python scripts/create_finetune_job.py
```

After the job succeeds, set:

```bash
OPENAI_FINE_TUNED_MODEL=ft:...
```

Then restart the backend. A serious fine-tune should use reviewed examples from epidemiologist-style workflows, not only the starter examples.

## HL7/EHR Processing

Synthetic ADT_A01-style messages include:

- MSH
- PID
- PV1
- OBX
- DG1

The parser returns structured fields, validation status, missing field checks, and data quality issues. Synthetic messages are sampled from the simulated encounters and can include missing chief complaints, missing diagnosis codes, delayed report dates, duplicate event message IDs, and inconsistent syndrome labels.

## Database Schema

Tables:

- `facilities`
- `synthetic_hl7_messages`
- `parsed_encounters`
- `surveillance_metrics`
- `anomaly_results`
- `rag_documents`
- `generated_reports`

## API Endpoints

- `POST /api/generate-synthetic-data`
- `GET /api/records`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/trends`
- `GET /api/hl7/messages`
- `POST /api/hl7/parse`
- `POST /api/ml/run-detection`
- `GET /api/ml/anomalies`
- `GET /api/ml/forecast`
- `POST /api/rag/query`
- `POST /api/rag/reindex`
- `GET /api/rag/status`
- `POST /api/insights/generate`
- `POST /api/reports/generate`

## Local Setup

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Generate initial data:

```bash
curl -X POST "http://localhost:8000/api/generate-synthetic-data?force=true"
curl -X POST http://localhost:8000/api/ml/run-detection
```

Use `force=true` when you want to rebuild the local synthetic dataset after changing the simulation design.

## Why This Matters

Public health analysts often need to distinguish a real early signal from data quality artifacts. This prototype demonstrates how AI/ML and RAG can support that workflow by combining synthetic HL7/EHR-style data, explainable anomaly detection, indicator lag logic, facility-level quality flags, and retrieval of relevant public health knowledge.

The output is decision support for epidemiologist review, not automated outbreak confirmation.

## Docker Setup

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

## Screenshots

Place screenshots in a future `docs/screenshots` directory:

- `landing-page.png`
- `dashboard.png`
- `ml-detection.png`
- `knowledge-retrieval.png`
- `investigation-brief.png`

## Research Disclaimer

This is an independent research prototype. It uses only synthetic data. It does not use real patient data, does not connect to employer systems, does not reference confidential systems, and should not be used for operational clinical or public health decision-making.

## Future Work

- FHIR support
- real-time pipeline
- advanced NLP chief complaint classification
- LSTM or Transformer forecasting
- graph-based outbreak propagation
- privacy-preserving analytics
- cloud deployment on AWS
