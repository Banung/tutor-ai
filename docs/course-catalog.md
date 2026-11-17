# FR-001 / FR-002 Course Catalog Setup

## Database migration

Apply the additive migrations with:

```bash
pnpm exec prisma migrate deploy
```

Migrations:

- `prisma/migrations/20261113000000_add_course_catalog`
- `prisma/migrations/20261114010000_add_course_catalog_status_log` (adds the
  `course_catalog_status_log` audit table; no foreign keys, so history survives
  course or account deletion)

It adds `faculty`, `study_program`, and the catalog columns on `course`, then backfills
existing rows:

- `course.isActive = true` -> `catalogStatus = PUBLISHED`
- `course.isActive = false` -> `catalogStatus = DRAFT`

No course IDs, enrollment keys, instructors, enrollments, sessions, materials,
embeddings, or chat history are modified or deleted.

New rows, including courses created by lecturers through the existing route, default to
`DRAFT`. This is intentional: new lecturer-created courses are no longer discoverable by
students until an admin publishes them (FR-002). Existing student enrollment and access
rules continue to use `course.isActive`.

Course codes are stored trimmed and uppercase. PostgreSQL enforces both the
`(studyProgramId, courseCode)` uniqueness rule and the normalized 4–12 ASCII
alphanumeric format. Courses without a study program can keep a code; uniqueness starts
once a program is assigned.

## Course cover storage

Cover uploads reuse the existing Supabase credentials:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `SUPABASE_STORAGE_BUCKET` (defaults to `course-materials`)

Objects are stored under the `course-covers/` prefix. The bucket and its policies are
not created by the application. Missing credentials or a bucket that rejects JPG/PNG
uploads are deployment blockers.

Uploads are limited to 2 MiB and validated from actual file bytes: JPEG/PNG magic
numbers plus a real image decode through the installed `canvas` dependency. Empty,
header-only, malformed, truncated, and non-JPEG/PNG files are rejected before any
Supabase upload or database cover replacement. The public URL is stored in
`course.coverImage`; the owned object path is stored in `course.coverStoragePath`. The
generated SVG cover remains the fallback when no custom cover exists.

Metadata and cover upload remain separate operations. If metadata saves and the optional
cover upload fails, the admin UI keeps the saved course ID, refreshes the list, and shows
a retry action that uploads only the cover. It never repeats course creation for a cover
failure.

Instructor removal runs in a Prisma transaction that takes a PostgreSQL
`SELECT ... FOR UPDATE` row lock on the parent `course` before checking membership and
deleting. Publication, unpublish, archive, and published-metadata edits take the same
row lock so lifecycle changes serialize with instructor membership.

FR-001 API routes return messages only from typed business errors; unexpected exceptions
are logged with name/code only and return a stable generic message. Malformed JSON bodies
return a controlled 400 response.

## FR-002 publication, unpublish, and archive

Admin-only `POST /api/admin/courses/[id]/publication` accepts a strict body of
`{ action: "publish" | "unpublish" }`. The actor identity always comes from the
authenticated session; forged `actorId`/`catalogStatus` fields are rejected.

Lifecycle rules:

- `DRAFT -> PUBLISHED` (publish) and `PUBLISHED -> DRAFT` (unpublish) only. Neither
  changes `course.isActive`, and generic course PATCH still cannot set `catalogStatus`.
- Publishing an inactive course returns 409 with an instruction to enable access first.
  Publication is separate from class access.
- `ARCHIVED` cannot be published or unpublished, and there is no restore/unarchive.
- Repeating an already-satisfied action returns success with `changed: false` and writes
  no audit entry.
- Unpublish keeps existing enrollments, sessions, materials, and chat history. It only
  removes the course from student discovery and self-enrollment.
- Archive keeps the previous behavior (course hidden, access flag unchanged) and now
  records its transition.

Completeness is centralized in `getCoursePublicationIssues` and requires:

1. nonblank title, at most 150 characters;
2. normalized 4–12 ASCII alphanumeric course code;
3. an existing study program with its faculty;
4. at least one assigned instructor.

Description, learning outcomes, custom cover, and AR availability remain optional.
Because the FSD does not enumerate every field, this is the operational definition of
"data lengkap". An incomplete publish returns 400 with the FSD message
`Lengkapi data sebelum mempublikasikan entri.` and every failing field as
`missingFields: [{ field, message }]`; the admin UI lists all messages.

A published course cannot be edited into an incomplete state through the generic PATCH.
Such an edit returns 400 with the affected fields instead of silently unpublishing.
Lecturer title edits are capped at 150 characters, matching the publication constraint.

Every actual publish, unpublish, or archive transition commits with its audit row in the
same Prisma transaction after the course row lock. `course_catalog_status_log` stores
`courseId`, `actorId`, `fromStatus`, `toStatus`, and `createdAt`, indexed by
`(courseId, createdAt)`. It has no foreign keys, so removing a course or account does not
erase history. DRAFT creation, no-op repeats, and rejected actions never create entries.
No historical rows are fabricated.

## Tests

```bash
pnpm test
```

Tests use `tsx` with `node:test` and stub the Prisma client methods they exercise; they do
not require a database. Covered behavior includes publish/unpublish transitions, no-op
repeats, archived/inactive conflicts, all completeness fields, audit actor selection,
audit-write failure propagation, the published-metadata edit guard, and endpoint
authorization/payload validation.

`tests/fr002-harness-validation.test.ts` exercises the integration harness's real result
validators (`tests/integration/fr002-validation.ts`, side-effect free) against negative
observations: wrong final status, missing/duplicate/reordered/wrong-actor audit
transitions, wrong rejection status, wrong instructor count, unscoped lock evidence,
lost/changed preserved rows, messages matched by ID, unexpected endpoint responses,
self-enrollment success, and cleanup failures. These run offline, so a broken harness
validator fails `pnpm test` instead of passing silently.

### Opt-in lifecycle integration harness

`tests/integration/fr002-lifecycle.integration.ts` exercises the real service layer and a
real PostgreSQL connection. It is not picked up by `pnpm test` (`tests/*.test.ts`).

Two-step, explicit target confirmation:

```bash
FR002_INTEGRATION=1 pnpm exec tsx tests/integration/fr002-lifecycle.integration.ts --print-target
# compare database/schema/fingerprint with the intended disposable development target
FR002_INTEGRATION=1 FR002_TARGET_FINGERPRINT=<printed-fingerprint> \
  pnpm exec tsx tests/integration/fr002-lifecycle.integration.ts --confirm
```

`--confirm` also requires `DATABASE_URL` and `DIRECT_URL` to agree on host and project ref.

The harness exits non-zero unless every scenario matches its expectation: operation
success/rejection status, final catalog status, instructor count, exact audit transition
sequence with the fixture actor, populated-row preservation, endpoint responses, and
cleanup. It prints the JSON observation plus a `failures` array; failures are also
summarized on stderr. Rejection handlers are attached to concurrent operations before the
lock is released, and an aborted lock observation rolls back and drains started operations
before fixtures are deleted.

Lock coordination is fixture-scoped: the blocker connection reports its own
`pg_backend_pid()`, and the monitor walks the recursive `pg_blocking_pids` chain from that
backend. It asserts an empty baseline before starting, exactly one queued waiter (the
first operation), then exactly two with the first retained (the second operation). The
resulting order is therefore attributable to the tested operations, not a database-wide
waiter count. This proves the observed order for each fixture; it is not a general claim
about PostgreSQL FIFO behavior.

Forced orderings and fixtures:

1. publish then archive: both succeed, `DRAFT -> PUBLISHED -> ARCHIVED`, exactly 2 audit
   rows in that order, correct actor.
2. archive then publish: archive succeeds, publish 409, `DRAFT -> ARCHIVED`, exactly 1
   audit row.
3. publish then last-instructor removal: publish succeeds, removal 409, final PUBLISHED
   with 1 instructor and 1 publication audit row.
4. last-instructor removal then publish: removal succeeds, publish 400 incomplete, final
   DRAFT with 0 instructors and 0 audit rows.
5. populated preservation: enrolled student, course session, inline text material, chat
   session with 2 distinct messages; unpublish keeps the same IDs and contents (messages
   matched by ID and content). Existing-student course/session endpoints must return 200,
   discovery must exclude the course, and the second student's self-enrollment must be
   rejected with 400/409.

Endpoint checks are assertions, not soft skips: a reachable server with a failed login or
unexpected status fails the run. `--skip-http` is the only omission mode; it marks the run
partial by reporting `http: "skipped"` and `endpoints: {status: "skipped"}`. Without that
flag the harness expects a dev server at `FR002_BASE_URL` (default
`http://localhost:3000`).

Cleanup deletes only harness fixture courses/programs/faculties and asserts the deletion
count and that no fixture course remains. Any cleanup error fails the run. Audit rows are
retained intentionally (`courseId` then dangles because there is no FK). Fixture course IDs
and retained audit counts are printed in the JSON result.

Browser interaction for the admin controls is not automated: no browser tooling is
installed in this repository. Manual checklist: publish/unpublish confirmation and cancel,
missing-field message list, disabled duplicate submit while pending, and list/detail
status refresh after success.

### Audit retention note

The revision-1 verification deleted its fixture audit rows, contrary to the instruction to
preserve audit evidence. Those rows were not reconstructed. Every row written since then is
retained and includes fixture `courseId` values whose courses no longer exist; that is
expected for an append-only table without foreign keys.

## Out of scope

FR-003 onward, AR implementation, account/security redesign, bulk publication,
log-management UI, audit mutation endpoints, and permanent-delete changes. The audit table
is intentionally append-only by convention; no retention or export tooling ships with it.
