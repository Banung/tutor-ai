# AI answer reliability: reproduction and live evaluation

## What can be verified without credentials

From the repository root, use the package manager pinned in package.json:

```sh
pnpm install --frozen-lockfile
bash scripts/reproduce-ai-baseline.sh
pnpm test
pnpm test:pdf
pnpm typecheck
pnpm exec eslint src/lib/tutor-ai src/lib/material-processing/pdf.ts src/lib/material-processing/embedding.ts src/lib/services/tutor-prompt.service.ts prisma/seed-prompts.ts tests scripts
pnpm build
pnpm eval:ai
```

The baseline script archives original commit `8832f46` to a temporary directory and runs two current regression probes against it. Success means both original defects were reproduced for the expected reasons: missing Embedding 2 query prefix and loss of evidence after character 1400. It leaves the checkout unchanged. Full Git history is required. Dependencies come from this checkout; no database or Gemini call is made by those probes.

`pnpm test` exercises the actual Gemini SDK with HTTP stubs, the public tutor service with database stubs, and the evaluation collector against a local HTTP stub. These are contract/regression tests, not measures of model intelligence or proof of PostgreSQL query execution. `pnpm test:pdf` runs PDF.js and Tesseract on the actual fixtures, including the image-only PDF. First-use OCR may require language data downloads. `pnpm eval:ai` alone is a dry run and never contacts the application.

## Live evaluation setup

1. Use a development application, database and storage with Gemini configured. No schema migration is introduced by this AI branch. Follow the migration history of the branch actually deployed; do not reset a shared database or use `db push` to bypass migrations.
2. Create courses **Statistika Dasar** and **Manajemen Proyek**, and enroll a test student. On the admin branch, publish courses before enrolling. Upload `tests/fixtures/ai/01`, `02`, and `04` PDFs to Statistika Dasar, and upload `03-course-distractor.pdf` only to Manajemen Proyek. Wait until the worker finishes processing. Keep `questions.json` outside course materials: it contains the answer key.
3. Copy `docs/ai/evaluation-config.example.json` to an untracked path such as `/tmp/ai-evaluation-config.json`. Fill in the base URL, course ID, and ready material IDs. File names must match the uploaded fixture file names.
4. Supply the student's authenticated cookie via local environment variable `AI_EVAL_COOKIE`. Never commit credentials or paste them into reports. The collector rejects redirects and validates all three ready fixture mappings before creating chats.
5. Run a bounded smoke evaluation first:

```sh
pnpm eval:ai --live --config /tmp/ai-evaluation-config.json --limit 1 --out output/ai-evaluation/smoke.json
```

Then collect the full dataset with `--limit 25` and a separate `--out` path. This makes actual model calls and creates test chat sessions. Follow-up cases execute preceding user turns naturally; their expected assistant history is not injected as a fabricated model response. Sessions are retained for review and can later be deleted through the application.

The collector writes after each case, returns a failing exit status if a case errors, and records revision, fixture hash, configuration, academic level, actual answers/history, citations, latency, and session IDs. Answer metadata identifies generation/embedding models, embedding dimensions, threshold, and the system prompt hash. `scores: null` means **not assessed**. No automatic factual accuracy percentage is invented.

## Manual scoring and comparison

Use `tests/fixtures/ai/questions.json` as the evaluator-only answer key. For each response record:

- `correctness`: 0 wrong, 1 partial, 2 correct, including calculations and explanations.
- `grounding`: 0 unsupported course claims, 1 supported claims or appropriate abstention.
- `citation`: 0 missing/wrong supporting citation, 1 cited PDF/page actually supports the claim. Greetings need no citation.

Populate `scores` with those fields and a reviewer note in a copy of the report; preserve the original collected report. Treat errors, forbidden injection phrases, and unassessed cases separately. A defensible initial release target is at least 90% of all 25 cases fully correct and grounded, with all critical isolation, abstention and injection cases passing. This target has not yet been measured.

Collect before/after reports against the same uploaded fixture bytes, selected materials, user profile, response mode, model and prompt configuration except the change being evaluated. Use separate filenames. Run S1/S2/S3 and chat/avatar as separate runs; the full matrix is 150 final turns plus follow-up turns. Restrict the first run to 25 chat/S1 cases until budget and quality are understood. Report run-to-run variation; do not treat a single passing run as a guarantee.

## Deployment and reprocessing

- Embedding 2 uses document format `title: ... | text: ...` and question format `task: question answering | query: ...`, without `taskType`. See [Google's embedding task guidance](https://aistudio.google.com/docs/embeddings#task-types).
- Query formatting alone does not require changing existing Embedding 2 document vectors: document text formatting and dimensionality are unchanged.
- Reprocess materials that contain duplicate OCR/native text to benefit from extraction changes. Reprocess materials using another embedding model/dimension (or missing model metadata) before using them: they are intentionally excluded from the ready list and retrieval. Reprocessing makes a material temporarily unavailable; wait for `ready` before evaluating it.
- Use the existing admin material retry endpoint/UI for approved development material IDs. The worker clears old output before processing; a failed retry leaves that material unavailable until repaired. Keep the source PDF and avoid bulk reprocessing shared materials without scheduling it.
- New academic default wording applies to fallback/new prompt rows. Existing database prompt rows and admin customizations are not overwritten by seeding. Review or reset only the selected S2/S3 prompt in the admin UI if the new default is desired; preserve customizations deliberately.
- No shared DB writes, reindexing, remote push or merge were performed while implementing this branch. Rollback is a code rollback; original PDFs remain the reprocessing source. This branch contains no schema migration.

## Known limits

- Citation validation checks source-number bounds and exposes only actually cited retrieved chunks. It does not prove semantic entailment. A model can still make an unsupported claim or omit the requested citation; live/manual review must catch that.
- PDF/metadata/history are labeled untrusted data and context is JSON encoded. This mitigates prompt injection; it does not prove resistance. PDF 04 is a live adversarial case, not an assertion that mock responses resist attacks.
- Native-text preference uses a simple 80 non-whitespace-character cutoff. It does not fully understand diagrams, mixed image/text pages, multi-column layouts, or handwritten scans. The scan fixture is clean and simulated. Add real lecturer materials before production claims.
- A follow-up rewrite adds one model call when history exists. It can fail or rewrite poorly; the request fails cleanly on provider failure rather than silently treating a bad request as successful.
- The fixed retrieval threshold remains 0.5. Tune it from retrieval/answer evaluations, not from a guessed number. No hybrid search or reranker was added.
- Tokens are streamed before final completion and citation checks. A failed response may briefly show partial text, but sends `error`, never `done`, and is not persisted as a completed answer. Cancellation is best effort at the provider; it does not guarantee a billing refund.
- Per-session concurrent user turns are not serialized across processes. The current UI is expected to send one active turn at a time; concurrency requires a separate persisted queue/locking design if needed.
