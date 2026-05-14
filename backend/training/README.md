# Fine-Tuning Plan

RAG indexing and model fine-tuning are separate:

- RAG indexing stores public health knowledge documents for retrieval.
- Fine-tuning teaches the model the preferred response style, structure, cautions, and analyst workflow.

The starter `rag_finetune_examples.jsonl` file is intentionally small. A serious fine-tune should include reviewed examples covering:

- true respiratory outbreak interpretation
- gastrointestinal gradual increases
- facility batch uploads
- duplicate message artifacts
- missing chief complaint and missing diagnosis issues
- older-adult severity signals
- low-confidence or undetermined anomalies

Create a fine-tuning job:

```bash
cd backend
export OPENAI_API_KEY=...
export OPENAI_FINE_TUNE_BASE_MODEL=gpt-4o-mini
python scripts/create_finetune_job.py
```

After the job completes, set:

```bash
OPENAI_FINE_TUNED_MODEL=ft:...
```

Then restart the API.
