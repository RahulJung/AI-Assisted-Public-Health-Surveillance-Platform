from pathlib import Path
import hashlib
import json

import chromadb
from sqlalchemy.orm import Session

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None

from app.core.config import settings
from app.models.entities import RagDocument


SYSTEM_PROMPT = """You are writing as a senior public health surveillance analyst helping another analyst interpret a signal.

Use only the retrieved knowledge snippets and supplied anomaly context. Do not invent facts, do not cite unavailable sources, and do not say an outbreak is confirmed.

Write in a calm, human, professional voice. Avoid generic AI phrasing such as "it is essential to", "delve into", "warrants careful evaluation", "in conclusion", "hints at", "observed increase", "this dynamic", "potential early transmission signal", "greater clarity could emerge", or "the situation remains unclear". Prefer concrete language: "This looks more like...", "I would first check...", "The main concern is...", "What would change my mind is...".

Keep the answer concise:
- Start with a 2-3 sentence interpretation that sounds like an analyst talking to a colleague.
- Then give 3-5 practical follow-up steps.
- End with 1 sentence on uncertainty or data quality.

Do not use markdown tables. Use short bullets only when they make the analyst workflow easier to scan."""


class RagService:
    def __init__(self):
        self.local_model = None
        self.openai_client = OpenAI(api_key=settings.openai_api_key) if OpenAI and settings.openai_api_key else None
        self.provider = settings.rag_provider.lower()
        self.embedding_model_name = settings.openai_embedding_model if self.uses_openai_embeddings else "local-hash-384"
        collection_name = f"public_health_knowledge_{self.embedding_model_name.replace('-', '_').replace('.', '_')}"
        self.client = chromadb.PersistentClient(path=settings.chroma_path)
        self.collection = self.client.get_or_create_collection(collection_name)

    @property
    def uses_openai_embeddings(self) -> bool:
        return self.provider == "openai" and bool(settings.openai_api_key) and OpenAI is not None

    @property
    def uses_openai_generation(self) -> bool:
        return self.provider == "openai" and bool(settings.openai_api_key) and OpenAI is not None

    def _local_model(self):
        if SentenceTransformer is None:
            return None
        if self.local_model is None:
            try:
                self.local_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
            except Exception:
                self.local_model = None
        return self.local_model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self.uses_openai_embeddings and self.openai_client:
            response = self.openai_client.embeddings.create(model=settings.openai_embedding_model, input=texts)
            return [item.embedding for item in response.data]

        model = self._local_model()
        if model is not None:
            return model.encode(texts).tolist()

        vectors = []
        for text in texts:
            vector = [0.0] * 384
            for token in text.lower().split():
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                index = int.from_bytes(digest[:2], "big") % len(vector)
                vector[index] += 1.0
            norm = sum(value * value for value in vector) ** 0.5 or 1.0
            vectors.append([value / norm for value in vector])
        return vectors

    def chunk(self, text: str, size: int = 1200) -> list[str]:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks, current = [], ""
        for paragraph in paragraphs:
            if len(current) + len(paragraph) > size and current:
                chunks.append(current.strip())
                current = paragraph
            else:
                current = f"{current}\n\n{paragraph}".strip()
        if current:
            chunks.append(current)
        return chunks

    def index_documents(self, db: Session) -> dict:
        base = Path(settings.knowledge_base_path)
        count = 0
        ids, docs, metas = [], [], []
        for path in sorted(base.glob("*.md")):
            content = path.read_text(encoding="utf-8")
            title = content.splitlines()[0].replace("#", "").strip() if content.splitlines() else path.stem
            existing = db.query(RagDocument).filter(RagDocument.source == path.name).first()
            if not existing:
                db.add(RagDocument(source=path.name, title=title, content=content))
            for index, chunk in enumerate(self.chunk(content)):
                ids.append(f"{self.embedding_model_name}-{path.stem}-{index}")
                docs.append(chunk)
                metas.append({"source": path.name, "title": title, "provider": self.provider, "embedding_model": self.embedding_model_name})
                count += 1
        db.commit()
        if docs:
            embeddings = self.embed(docs)
            self.collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
        return {"indexed_chunks": count, "provider": self.provider, "embedding_model": self.embedding_model_name}

    def query(self, question: str, db: Session, n_results: int = 4, anomaly_context: dict | None = None) -> dict:
        if self.collection.count() == 0:
            self.index_documents(db)
        embedding = self.embed([question])[0]
        result = self.collection.query(query_embeddings=[embedding], n_results=n_results)
        snippets = []
        for doc, meta in zip(result.get("documents", [[]])[0], result.get("metadatas", [[]])[0]):
            snippets.append({"source": meta["source"], "title": meta["title"], "snippet": doc[:900]})
        checklist = checklist_for_question(question, anomaly_context)
        indicators = related_indicators(question, anomaly_context)
        answer = self.synthesize_answer(question, snippets, checklist, indicators, anomaly_context)
        return {
            "answer": answer,
            "supporting_snippets": snippets,
            "investigation_checklist": checklist,
            "related_indicators": indicators,
            "provider": self.provider,
            "embedding_model": self.embedding_model_name,
            "generation_model": self.generation_model_name(),
            "fine_tuned_model": settings.openai_fine_tuned_model or None,
        }

    def generation_model_name(self) -> str:
        if not self.uses_openai_generation:
            return "template"
        return settings.openai_fine_tuned_model or settings.openai_rag_model

    def synthesize_answer(self, question: str, snippets: list[dict], checklist: list[str], indicators: list[str], anomaly_context: dict | None) -> str:
        if self.uses_openai_generation and self.openai_client:
            model = settings.openai_fine_tuned_model or settings.openai_rag_model
            context = "\n\n".join([f"Source: {s['source']}\n{s['snippet']}" for s in snippets])
            prompt = {
                "question": question,
                "anomaly_context": anomaly_context or {},
                "retrieved_context": context,
                "style": "human public health analyst note, direct and specific, not chatbot-like",
                "write_for": "epidemiologist or syndromic surveillance analyst reviewing a possible signal",
                "required_content": {
                    "interpretation": "state what the evidence leans toward and why, using plain analyst language",
                    "artifact_vs_outbreak_reasoning": "explicitly discuss whether this looks more like a reporting artifact, true signal, severity signal, or still unclear",
                    "recommended_follow_up": checklist,
                    "related_indicators": indicators,
                    "uncertainty": "state what would change your interpretation, in one practical sentence",
                },
            }
            response = self.openai_client.responses.create(
                model=model,
                temperature=0.35,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(prompt, indent=2)},
                ],
            )
            return response.output_text

        sources = ", ".join(sorted({s["source"] for s in snippets})) or "local knowledge base"
        return (
            f"For the question '{question}', review whether the signal is epidemiologically plausible and technically valid. "
            f"The retrieved knowledge emphasizes baseline comparison, indicator triangulation, facility workflow review, lag interpretation, and data quality checks. "
            f"Use the checklist below and cite supporting material from: {sources}."
        )


def checklist_for_question(question: str, anomaly_context: dict | None = None) -> list[str]:
    q = question.lower()
    items = [
        "Verify the signal against recent baseline and same-day reporting completeness.",
        "Compare ED visits, test positivity, hospitalizations, and deaths for temporal ordering.",
        "Review facility-level contribution and reporting delays before escalation.",
    ]
    signal_type = (anomaly_context or {}).get("signal_type", "")
    if "facility" in q or "spike" in q or signal_type == "reporting artifact":
        items.append("Check duplicate message IDs, downtime windows, backfills, and batch-upload timing.")
    if "respiratory" in q or "covid" in q:
        items.append("Stratify by age group and review whether positivity rose before ED visits.")
    if "quality" in q or "mimic" in q:
        items.append("Inspect missing chief complaints, missing diagnoses, delayed reports, and inconsistent labels.")
    return items


def related_indicators(question: str, anomaly_context: dict | None = None) -> list[str]:
    q = question.lower()
    indicators = ["ED visits", "test positivity", "hospitalizations", "deaths", "reporting delays", "data quality score"]
    if "facility" in q or (anomaly_context or {}).get("signal_type") == "reporting artifact":
        indicators.extend(["facility volume share", "message batch timing", "duplicate message count"])
    if "age" in q or "respiratory" in q:
        indicators.extend(["age-group distribution", "chief complaint terms"])
    return indicators


rag_service = RagService()
