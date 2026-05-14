import os
from pathlib import Path

from openai import OpenAI


TRAINING_FILE = Path(__file__).resolve().parents[1] / "training" / "rag_finetune_examples.jsonl"


def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set. Export it before creating a fine-tuning job.")

    base_model = os.getenv("OPENAI_FINE_TUNE_BASE_MODEL", "gpt-4o-mini")
    suffix = os.getenv("OPENAI_FINE_TUNE_SUFFIX", "public-health-rag")
    client = OpenAI(api_key=api_key)

    uploaded = client.files.create(file=TRAINING_FILE.open("rb"), purpose="fine-tune")
    job = client.fine_tuning.jobs.create(training_file=uploaded.id, model=base_model, suffix=suffix)
    print(f"training_file_id={uploaded.id}")
    print(f"fine_tuning_job_id={job.id}")
    print("After the job succeeds, set OPENAI_FINE_TUNED_MODEL to the returned fine-tuned model id.")


if __name__ == "__main__":
    main()
