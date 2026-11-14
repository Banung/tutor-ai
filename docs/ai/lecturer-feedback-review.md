# Lecturer feedback review (FB-04)

Branch: `feat/lecturer-feedback-review`, based on student-feedback commit `86c4871` and run-tracking commit `394bef9`. This feature implements the negative-feedback queue required by AC-018/BR-040. It does not implement correction authoring or reuse in AI answers (FB-05/FR-013).

## Product behavior

- Dosen Panel has a **Feedback Jawaban** navigation entry at `/dosen/feedback`.
- The queue defaults to **Belum ditinjau**, includes only current negative feedback from courses assigned to the signed-in lecturer, and supports course/status filters and 20-item pagination.
- `/dosen/feedback/:feedbackId` shows the reported AI answer, its associated question, cited source summaries, rating/reason/note, reviewer, completion time, and up to 100 most recent history events.
- No full conversation, student name/email/profile, prompt configuration, or run evidence dump is exposed. A run ID may be present for traceability. Questions are matched by `run.userMessageId`; legacy answers without that link use the preceding user message in the same chat as a best-effort association.
- Reading the queue/detail or mutating review state requires a current **dosen** role and a course-instructor assignment. Admin and student accounts cannot use these endpoints. Positive-only feedback is not exposed through guessed detail IDs; a previously negative, now withdrawn item remains inspectable by assigned lecturers through its review history.
- Unpublishing a course does not remove its lecturer's review access; removing the instructor assignment does.

## Review lifecycle

1. `pending` — belum ditinjau. An assigned lecturer starts a review.
2. `in_review` — sedang ditinjau. Only the claiming lecturer can finish or release an active review. Another lecturer sees it but cannot overwrite it.
3. `completed` — selesai ditinjau. Reviewer and completion time are retained; any assigned lecturer can reopen it as a new review decision.
4. `withdrawn` — student changed the rating to positive. The item leaves the negative queue. Historical decisions remain attached to the same feedback record.

If the current reviewer is deleted, loses the dosen role, or is no longer assigned, a remaining assigned lecturer can release the orphaned review back to pending, then claim it.

Marking a review completed does **not** change the original answer, publish a correction, or teach the AI. The UI explains that limitation.

## Student edits and concurrency

`AiMessageFeedback` remains the single deduplicated record per user/answer. It adds review status, reviewer, completion time, and a monotonically increasing revision. `AiFeedbackReviewEvent` records each substantive feedback change or lecturer status change, its before/after snapshot, actor, time and revision.

- An identical student save is a no-op: it does not reopen a completed review or create duplicate history.
- A changed negative rating/reason/note reopens the item as pending and clears the current reviewer/completion time. Prior review events preserve the earlier status and feedback snapshot.
- A change to positive withdraws the item. Returning to negative reopens the same item, rather than creating another queue entry.
- Both student edits and lecturer decisions run in serializable transactions. Conflicts are retried at most three times; terminal conflict returns HTTP 409. History failures roll back the associated state change.
- Lecturer PATCH requests include `expectedRevision`. A stale page cannot overwrite a student edit or another lecturer's decision. The UI requires reloading after an uncertain/conflicting save.
- Feedback deletion still cascades from chat/message/user deletion; history has the same lifetime as feedback. This is not an independent permanent audit archive.

## API

- `GET /api/dosen/feedback?courseId=...&status=pending|in_review|completed|all&page=1`
- `GET /api/dosen/feedback/:feedbackId`
- `PATCH /api/dosen/feedback/:feedbackId` with `{ "status": "in_review" | "completed" | "pending", "expectedRevision": 1 }`

Actors, reviewer IDs and timestamps are assigned by the server. Unknown mutation properties are rejected. Read responses use `private, no-store`. Unexpected API errors return a generic message, not raw database details. Existing student feedback payloads and the accepted dialog UI are unchanged.

## Migration and validation

Apply migrations in order against the development database:

1. `20261114090000_add_ai_response_runs`
2. `20261114100000_add_ai_message_feedback`
3. `20261114110000_add_lecturer_feedback_review`

The third migration adds review fields/history and marks pre-existing positive ratings withdrawn. Existing negatives start pending; no fictional pre-migration review history is generated. No migration, seed or live database writes were performed during implementation.

Automated tests exercise service authorization/query scoping, status transitions, stale revisions, CAS conflicts, serializable retry bounds, atomic state/history failures, edited/withdrawn feedback, duplicate saves, positive-only privacy, and orphaned-review recovery. Database operations and provider HTTP calls in these tests are mocked. They do not prove PostgreSQL transaction behavior, end-to-end browser behavior, or live model quality.

## Later development/UAT checklist

- Apply migrations, sign in as a student and submit negative feedback on a completed answer.
- Confirm exactly one queue item appears for an assigned lecturer and no other course's lecturer can GET/PATCH it.
- Test list course/status filters, empty/error/loading states, pagination, keyboard navigation and a narrow viewport.
- Claim and complete a review; verify reviewer/time/history and that the AI answer remains unchanged.
- Open the same item in two lecturer sessions: verify only one claim wins and stale updates return 409.
- Change the student's note while a lecturer has the detail open: verify reset to pending, preserved history, and stale-save rejection.
- Change rating to positive, then negative: verify withdrawal, retained history and no duplicate queue record.
- Remove the claiming lecturer's assignment and verify a remaining assigned lecturer can release/reclaim the item.
- Confirm neither positive-only feedback nor arbitrary full conversation history is exposed.
- Verify database rollback on a history-write failure in a development test environment.

These live/database/browser checks remain deferred as requested. No browser preview was invoked for this feature.

## Recorded local checks (14 November 2026)

- `pnpm test`: 71 passed, 0 failed.
- `pnpm build`: exit 0; lecturer queue/detail pages and API routes generated.
- `pnpm typecheck`: passed.
- Targeted ESLint for feedback services, lecturer UI/API and tests: passed.
- `prisma validate`: schema valid.

These checks exclude the deferred live database/UAT scenarios above.
