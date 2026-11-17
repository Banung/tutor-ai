# FR-003 User and Access Management

## Roles

Exactly one primary role per account: `mahasiswa`, `dosen`, or `admin`. The role column
is the single source of truth for API authorization (`requireAdmin`, `requireDosen`,
`requireMahasiswa`) and is read from the database on every `getSession` call, so a role
change applies to fresh requests/logins without a forced logout feature.

## Identifiers

| Field | Roles | Required | Storage |
| --- | --- | --- | --- |
| `npm` (FSD NIM) | mahasiswa | yes | `text`, unique |
| `academicLevel` | mahasiswa | yes (`S1`/`S2`/`S3`) | `text` |
| `nip` | dosen | optional | `text`, unique |
| `nidn` | dosen | optional | `text`, unique |

`npm`, `nip`, and `nidn` are nullable strings, never numbers, so leading zeros survive.
Provided values are trimmed and must match `^[0-9]{8,18}$`; blank optional values become
`null`. Duplicate identifiers return a controlled 409 (`NPM/NIP/NIDN sudah digunakan.`).
Existing development users are not backfilled: the seeded lecturer may have no NIP/NIDN,
and no fake identifier is invented.

### Legacy profile policy

- `admin`: no academic or staff identifier.
- `dosen`: NIP/NIDN optional; NPM and academic level are not allowed.
- `mahasiswa`: NPM and academic level required; NIP/NIDN are not allowed.

When a role actually changes, incompatible fields are cleared in the same update:
mahasiswa -> other clears `npm`/`academicLevel`; any other role -> non-dosen clears
`nip`/`nidn`; staff -> admin clears `nip`/`nidn` (kept for dosen). An unrelated profile
save never clears fields. The merged resulting profile is validated, so a PATCH cannot
leave a mahasiswa without NPM or give a dosen an NPM.

## Transactional role changes

`updateUser(id, data, actorId)` runs in one Prisma transaction:

1. Lock the actor and target `user` rows, always ascending by user id. This is the only
   lock order used for user rows; no course row is taken while holding a user lock, so
   role changes cannot cycle with publication/instructor-removal course locks.
2. Load the actor inside the transaction and require `role = admin`. A session that was
   authorized before a concurrent demotion cannot complete the change.
3. Reject a self role change (403) and self deletion (403). Own-profile edits with an
   unchanged role remain allowed.
4. Reject demoting a `dosen` who still has `course_instructor` assignments (409). No
   assignment, course, enrollment, session, material, or chat row is deleted or
   unpublished.
5. Validate the merged profile, check identifier uniqueness, update the profile, and insert
   one `user_role_audit` row only when the role actually changed. Audit insert failure
   aborts the transaction, so the role change rolls back.

Same-role saves never write a transition row.

`assignInstructor` takes the same target user row lock before checking `role = dosen` and
creating the assignment. Therefore:
- demotion first -> assignment sees the new role and is rejected;
- assignment first -> demotion sees the assignment and returns 409.

Both orderings are exercised by the opt-in harness with real PostgreSQL locks.

## Account creation and the Better Auth boundary

`POST /api/admin/users` preflights email/NPM/NIP/NIDN conflicts, then creates the auth
account with `auth.api.signUpEmail`, then finalizes role/profile in one transaction:

- Known identifier/email conflicts fail before signup as ordinary 4xx responses; no
  account is created.
- Better Auth creates the account with the default `mahasiswa` role.
- The transaction locks the actor and the created user rows in the same ascending-id order
  used by `updateUser`, then rechecks that the actor still exists and is still an admin.
  A session authorized before a concurrent demotion cannot finalize an elevated role.
- Elevated roles are applied inside the transaction together with their audit row.
  Audit/finalization failure rolls the role back, so no unaudited elevated account remains.
- If finalization fails after account creation, the account is retained in its default
  mahasiswa state. It is never deleted as compensation, because deleting by email could
  remove a pre-existing account.

### Partial provisioning outcome

For a still-authorized admin, finalization failure returns a machine-readable partial
result (`409` for a raced identifier/email uniqueness conflict, `500` otherwise):

```json
{
  "partial": true,
  "userId": "<created user id>",
  "accountState": "default_mahasiswa",
  "error": "Akun dibuat tetapi finalisasi gagal: NIP sudah digunakan.",
  "issues": ["NIP sudah digunakan."]
}
```

The original business conflict is preserved in `issues`. A revoked/deleted actor instead
receives a plain `403` with no account ID or recovery details; the retained account stays
at the default mahasiswa role.

The admin UI parses this shape (`src/lib/user-provisioning.ts`), refreshes the list, keeps
the saved user ID, switches the open dialog to edit mode with a warning banner, and
preserves the entered values. Saving then repairs the existing account through `PATCH`;
the admin must not repeat signup. Ordinary pre-creation failures remain ordinary errors.

### Public auth hardening

`role` is declared with `input: false` in `src/lib/auth.ts`. With the installed
Better Auth 1.6.9:

- signup ignores a supplied `role` (the account default is applied);
- `update-user` rejects a supplied `role` with `400` and does not change it.

Ordinary signup, login, and name/profile updates are unchanged. The live harness verifies
both paths.

## Search and API

`GET /api/admin/users` trims the search term and matches name, email, NPM, NIP, or NIDN,
keeping the existing role and academic-level filters.

Validation failures return 400; duplicate identifiers/email and assigned-lecturer
demotion return 409; missing users 404; unauthorized 401/403. Mutation routes accept only
strict JSON bodies (forged `actorId`/`status` fields are rejected) and unexpected
exceptions are logged via `logUnexpectedError` and returned as the generic 500 message.

## Database

Migration `prisma/migrations/20261114020000_add_user_identifiers_and_role_audit`:

- adds nullable unique `user.nip` and `user.nidn`;
- adds `user_role_audit` with `userId`, `actorId`, `fromRole`, `toRole`, `createdAt` and an
  index on `(userId, createdAt)`.

The audit table has no foreign keys, so records survive user deletion (fixture `userId`
values may dangle by design). No existing rows are modified or backfilled.

Apply with:

```bash
pnpm exec prisma migrate deploy
```

## Tests

`pnpm test` is database-independent. `tests/user-management.test.ts` covers identifier
boundaries (7/8/18/19 digits, non-digits, whitespace, leading zeros, blank/null),
role-specific profile rules, invalid roles, forged actor fields, merged PATCH validation
and field clearing, self-role rejection, unchanged-role self edits, actor revalidation,
one-transition audit writes, audit-failure rollback, duplicate identifiers/email,
assigned-lecturer demotion, controlled malformed JSON / generic 500 responses, and the
assignment lock ordering.

Additional creation regressions cover: demoted/deleted actor during finalization; one
audit transition for elevated creation; pre-signup identifier/email conflicts; raced
post-signup uniqueness conflict producing the partial shape; audit failure leaving the
default role; route-level partial JSON; and the UI partial parser. Harness validators
(immediate rejection capture, timeout, missing/duplicate/non-retained waiters, cleanup
failure) are also unit-tested, along with the cleanup safety gate: confirmed
release+drain permits deletion; a drain timeout, failed release, late-completing
operation, or retained rollback/drain failure withholds it; deferred cleanup is reported
as a failure, not a pass.

### Opt-in live harness

`tests/integration/fr003-users.integration.ts` exercises the real APIs and PostgreSQL.
It is not part of `pnpm test`.

```bash
FR003_INTEGRATION=1 pnpm exec tsx tests/integration/fr003-users.integration.ts --print-target
FR003_INTEGRATION=1 FR003_TARGET_FINGERPRINT=<printed> \
  pnpm exec tsx tests/integration/fr003-users.integration.ts --confirm
```

Endpoint verification is mandatory: there is no skip/omission mode. The harness asserts
rather than reports: any failed check, cleanup error, timeout, or wrong waiter count exits
non-zero. It creates `T6`-prefixed users through the real admin API, verifies identifier
persistence/search, role transitions and audit rows, anonymous/non-admin rejection, forged
role input on public auth paths, fresh-login permissions, creation-actor revalidation,
duplicate-identifier pre-creation behavior, both assignment/demotion orderings, and
concurrent reciprocal admin changes.

Lock observations are scoped to the fixture blocker backend via its `pg_backend_pid()` and
the recursive `pg_blocking_pids` chain. Each ordering confirms exactly one waiter, then
exactly two distinct waiters with the first retained, before the blocker is released. The
exact waiter PIDs are recorded in `lockEvidence`. HTTP calls use explicit 15s abort
timeouts; rejection handlers are attached when each operation starts.

Failure-path safety: a waiting timeout only stops the client from waiting. It does **not**
cancel the underlying signup/service operation, and an HTTP abort is not proof of
server-side cancellation. `runLockedPairSafely` therefore tracks whether the blocker was
released and whether every started operation actually settled (bounded drain). Rollback or
drain failures are retained alongside the original error. An HTTP request that aborts or
times out also marks the run uncertain. Fixtures are deleted only when every pair confirms
release and settlement and no HTTP outcome is unknown.

If release or settlement remains uncertain, automatic fixture deletion is skipped and the
result carries `cleanup.deferred: true`, the reason, and a sanitized ownership manifest
(`emailPrefix`, plus known user/course/program/faculty IDs). The process exits non-zero;
it never reports `remainingFixtures: 0` or cleanup success without checking. A deferred run
leaves its fixtures for manual cleanup.

Cleanup removes harness-owned users, courses, and academic references; audit rows are retained, including
rows whose fixture users were deleted.

Live audit fault injection is **NOT RUN**. Revision 2 does not authorize trigger/function
DDL, so the normal `--confirm` path performs no such DDL and does not claim a live rollback
check. Transactional rollback is covered by DB-free failure-injection tests.

Browser checks are not automated in this repository (no browser tooling installed).
Manual checklist: identifier fields per role, search by NPM/NIP/NIDN, own-role select
disabled and own delete hidden, duplicate/invalid identifier error display, list refresh
after save, and the partial-provisioning banner/edit-mode recovery without repeating
signup.

## Out of scope

FR-004 session security/account freezing, SIAT integration, generic audit framework or
dashboard, bulk user operations, role management UI redesign, and Storage/AI calls.
