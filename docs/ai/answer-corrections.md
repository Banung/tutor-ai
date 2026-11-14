# Lecturer answer corrections (FB-05 / FR-013)

Branch: `feat/lecturer-answer-corrections`, based on lecturer-review commit `0636d72`. Scope is lecturer authoring/approval/revocation and server-side retrieval. No admin feature, automatic model training, grade changes or new live-model quality claim is introduced.

## Usage and version lifecycle

Open a reported answer in **Dosen → Feedback Jawaban**. The **Koreksi jawaban** section lets an assigned lecturer:

1. Write a canonical reference question (3–1000 characters), corrected answer (10–2000), rationale (3–1000), and choose 1–5 distinct supporting chunks from active ready course PDFs. Sources can be searched by title/content and paged in groups of 30.
2. Save a new immutable draft version. Creating a draft does not change tutor behavior. Copying a previous version creates another draft; existing content/source snapshots are not edited in place.
3. Review and explicitly approve a draft. If that normalized question already has an approved version, the dialog displays the active answer being replaced and submits its ID as the expected version.
4. Withdraw an approved version with a reason (3–500 characters). The old version and earlier run snapshots remain inspectable. A superseded/withdrawn version can be copied into a newly reviewed draft, rather than reactivated silently.

**Dosen → Koreksi Jawaban** lists versions for assigned courses (course filter, 20-version pagination). It remains available when the originating chat/feedback has been deleted. Correction creation stays attached to the feedback workflow; the course manager can approve or withdraw retained versions.

Finishing a feedback review remains separate from approving a correction. Approval is available to current course instructors and does not require a second distinct approver. Actors/names/timestamps are set by the server. Admin/student accounts cannot use these endpoints.

## Sources and freshness

Each version stores the exact selected chunk text, material/session/page identifiers, file metadata, and material fingerprint. The fingerprint covers storage/file path, processing job identity, and the material's ordered chunk IDs/text/page positions. Any chunk edit, reindex, processing-lineage change, disabled material/session/course, missing chunk, or incompatible embedding metadata excludes the correction until a fresh version is approved.

This is a conservative text/processing snapshot, not a cryptographic digest of the original PDF bytes. Directly overwriting a storage object without changing any recorded metadata/extracted chunks is outside detection. A future source-ingestion content hash can strengthen this. Reprocessing identical text can also require renewed approval because job/chunk identities changed.

Version pages show **Sumber perlu ditinjau ulang** for stale drafts/approved versions. Staleness is computed from current sources; it does not mutate the historical snapshot. Withdrawal remains possible even when sources are stale. The list of related versions in one feedback panel shows up to 50 latest versions; the course manager is paginated.

## Approval, conflicts and provenance

- Question keys use normalized Unicode/lowercase/alphanumeric word spacing, scoped by course. Versions are numbered per course/question key.
- A PostgreSQL partial unique index permits at most one `approved` version for a course/question key. Concurrent draft numbering/approvals also use serializable transactions with bounded conflict retries.
- `expectedActiveVersionId` prevents replacing an active answer that the lecturer has not acknowledged. Stale confirmation returns 409 and asks the UI to reload/reconfirm.
- An approval first checks authority/source freshness, then embeds the reference question through the normal query-embedding helper. A failed provider call leaves draft and current approved version unchanged. The transaction checks role/assignment, sources and active-version expectation again before superseding the old version and approving the new one atomically.
- Author, approving/withdrawing lecturer, timestamps, withdrawal reason and supersession link are retained on version records. Content snapshots have no edit endpoint. Teacher identifiers/names are retained as historical scalar audit fields.
- Original feedback deletion clears the optional feedback link; correction versions survive until their course is deleted. Existing chat/run deletion behavior is unchanged.

## Retrieval and tutor integration

The tutor first verifies student course access and selected ready materials. It reuses the question embedding already generated for retrieval:

1. Query only approved correction versions in the current course, with matching model/dimensions.
2. Prefer an exact normalized question key; otherwise use cosine similarity with an initial threshold of **0.85**. At most eight candidates are inspected.
3. Require all supporting materials to be selected and each source snapshot to match current ready sources.
4. If two strongest candidates are within **0.03** and have different answer text, omit correction context rather than choose a possibly conflicting answer. Otherwise include at most one version.
5. Add its source chunks (deduplicated with normal retrieval, total context still capped at eight chunks) and its approved answer as labeled JSON reference data. It does not become system instructions or authorize unsupported claims. The generated answer still cites original material/pages.
6. Store full correction context in the run configuration and compact version/fingerprint identifiers in answer metadata. These indicate context supplied, not proof the model used every correction claim. Recheck approval/source freshness before committing a completed answer; an observed change fails the turn and preserves existing partial/error semantics.

The threshold/margin are conservative initial policy, not calibrated quality guarantees. Exact-key conflict protection is deterministic; semantic conflicts can be missed or benign paraphrases omitted. Source references verify identity/freshness, not whether the teacher's correction is factually entailed. Lecturer review and live original/paraphrase/unrelated-question evaluation remain required. Already streamed partial tokens cannot be recalled if a correction is revoked mid-turn; final revalidation prevents an observed stale correction from being committed as a completed answer, but is not a distributed real-time revocation barrier.

## API

- `GET /api/dosen/feedback/:feedbackId/corrections?search=...&page=1`: related versions and active source choices.
- `POST` on that URL: `{ question, answer, rationale, sourceChunkIds }` creates a draft.
- `GET /api/dosen/corrections?courseId=...&page=1`: retained course versions.
- `PATCH /api/dosen/corrections/:versionId`: `{ action: "approve", expectedActiveVersionId: string | null }` or `{ action: "withdraw", expectedActiveVersionId: string, reason }`.

Mutations use strict payload validation. Course access is checked on the server even when a caller guesses IDs. Reads use `private, no-store`. No full student chat or prompt configuration is exposed in the correction manager.

## Migrations and local verification

New migrations:

- `20261114120000_add_answer_corrections`: version table, pgvector question embedding, course/question version uniqueness, and partial approved-version uniqueness.
- `20261114121000_add_missing_tutor_prompt_config`: fixes a pre-existing missing migration discovered by the real-database integration test. It creates the prompt table/index when absent and preserves existing tables/customizations. It does not seed or overwrite prompt content.

Both were applied successfully to the verified isolated Docker database `127.0.0.1:55432/tutor_ai_local` using `.env.local`. No shared/remote database was migrated and no database reset was performed. The integration test creates UUID-prefixed synthetic users/courses/material chunks and cleans up its own data; the earlier manual QA course remains intact.

Restart a development server after Prisma generation/schema changes so its cached Prisma client picks up the new delegate. Deploy normal migrations before serving this code in another environment. Do not use `db push` as a substitute: partial unique indexes live in SQL migration history.

Local checks:

```sh
pnpm test
pnpm typecheck
pnpm build
# Targeted ESLint: changed correction/service/UI/API/tests.

# Optional narrow real-PostgreSQL integration test; requires the above local Docker DB and applied migrations.
DOTENV_CONFIG_PATH=.env.local RUN_LOCAL_CORRECTION_TESTS=1 \
  node --import dotenv/config --import tsx --test tests/integration/corrections.integration.ts
```

The DB test refuses any host/port/database other than the isolated local target. It tests actual source queries, version uniqueness, approval/replacement/revocation, cross-course/role rejection, source/processing changes, retained management after chat deletion, and run provenance using the real tutor service. Only provider HTTP is stubbed with synthetic embeddings/generation; no live Gemini credentials/calls or answer-quality scores are used. Unit tests additionally check normalized keys, strict validation, explicit active-version expectations and weak/ambiguous match selection.

Remaining UAT: browser interaction of the new forms/search/pagination/confirmation; two distinct instructors approving concurrently; live embedding/generation and original/paraphrase/unrelated-question scoring with real lecturer PDFs; performance on large materials. No preview/screenshot of the new UI was taken in this implementation turn.

Recorded checks (14 November 2026): 76 unit/regression tests passed; local PostgreSQL integration suite passed all 6 subscenarios plus its parent test; TypeScript, targeted ESLint, Prisma schema validation, and production build passed. Provider embedding/generation responses in integration tests are synthetic HTTP stubs. This is implementation evidence, not measured live answer accuracy.
