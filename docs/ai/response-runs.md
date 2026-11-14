# Persistent response runs

Every accepted tutor attempt creates an `AiResponseRun` after course access and chat ownership checks, before retrieval/provider calls. Invalid, unauthorized, and already-aborted requests create no run. Old chats are unchanged; there is no historical backfill.

## Request and retry contract

`POST /api/courses/:courseId/tutor/sessions/:sessionId/messages` accepts optional UUID `requestId` and `retryOfRunId` fields alongside `content` and `responseMode`. Older callers can omit the IDs; the server generates a request ID for them, but those callers cannot deduplicate network resends.

A database unique constraint on `(aiChatSessionId, requestId)` admits only one attempt for an ID, including concurrent requests. A duplicate returns HTTP 409 without invoking the provider or writing another message. It does not replay a stream. A request ID cannot be reused for different content. The stored hash fingerprints the submitted question, mode, and retry reference.

A deliberate retry uses a new request ID and may reference a previous failed, cancelled, or timed-out run in the same owned chat. Running/completed runs cannot be retry parents. The chat client checks its last unsuccessful request before resubmitting the same question; a running/completed attempt asks the user to reload history rather than generating another answer. This client-side reference lives in memory, not across browser reloads.

`GET /api/courses/:courseId/tutor/sessions/:sessionId/runs/:requestId` returns the persisted run, including private snapshots. It enforces course access and session ownership, and uses `private, no-store`. Admin/dosen access to another user's runs is not introduced.

## Lifecycle and snapshots

- `running`: stage is `retrieval`, then `generation`, then `persistence`.
- `completed`: the answer, session timestamp, and completed run are committed in one transaction.
- `failed`: retrieval/generation/persistence error category is retained without raw provider error messages.
- `timed_out`: provider deadline expired; the stage identifies retrieval versus generation.
- `cancelled`: request or stream consumer aborted before commit.

Runs contain question, response mode, start/end/duration, configured models, retrieval settings, the exact rendered system instruction and generation prompt, prompt hash, and full retrieved chunk snapshots. Snapshot content remains unchanged when a prompt or material is subsequently edited. These snapshots may contain conversation history and course content: treat them as private chat data. They are deleted with the chat session via a cascading foreign key.

Token usage records the latest generation usage metadata received from Gemini (including trailers), when present. It is not a total for embedding or follow-up rewrite calls and is not a billing ledger. Failed fixed-response/social turns may have no model call or token usage.

The run retains historical user/answer IDs as scalar identifiers. A failed pending user message is removed from visible history; its ID remains in the run for traceability. Only completed answers are persisted. SSE `run` exposes run/request IDs, and `done` includes persisted message IDs. The client requires `done`; EOF/partial text cannot finalize a successful answer.

## Migration and verification

Apply `prisma/migrations/20261114090000_add_ai_response_runs/migration.sql` through the normal Prisma migration deployment process before running this code against an existing database. Regenerate the Prisma client when installing dependencies. Do not substitute `db push` or reset a shared database.

`pnpm test` covers successful snapshots/message links/token usage, retrieval and generation timeouts, failed/incomplete generation, cancellation, failed persistence, duplicate completed/active requests, retry parents, and access checks using mocked database operations and HTTP provider responses. Database constraint execution and live Gemini behavior require development integration verification; unit tests do not establish them.

An abrupt process kill or database outage can leave a run `running` because no terminal write can execute. This version has no crash reconciliation worker or automatic takeover. Do not automatically retry such runs: first establish that the original process has stopped. Per-chat concurrent requests with different request IDs remain outside the idempotency guarantee.

Prompt publication, version browsing/rollback, an admin run dashboard, and feedback are separate features. Immutable run snapshots provide provenance without adding a prompt publishing workflow.
