# Verification record

Date: 2026-11-13. Base: `8832f46` (`origin/main` at implementation start). Branch: `fix/ai-answer-reliability`.

This record distinguishes local behavioral evidence from live answer quality. No `.env` or Gemini/database/storage credentials were available in this checkout. No live model quality score is claimed.

## Checks

Final command output is retained in `docs/ai/results/`. See each result file for test names and outcomes. Commands and setup are documented in [evaluation.md](evaluation.md).

- Original-code regression reproduction: expected failures confirmed (embedding prefix and chunk-tail loss).
- Automated SDK/service/evaluator tests: **28 passed, 0 failed**; see `tests.tap`.
- Real PDF extraction and scan OCR: **2 passed, 0 failed**; see `pdf.tap`.
- TypeScript: **passed**, no diagnostics; see `typecheck.txt`.
- Changed-code ESLint: **passed**, no diagnostics; see `changed-lint.txt`.
- Production build: **exit 0**, routes generated; see `build.txt`. Missing Better Auth URL/secret diagnostics are present because no runtime auth environment was configured. This build result is not a live authentication check.
- Whole-repository ESLint: **fails with 9 pre-existing errors and 12 warnings**; see `repository-lint.txt`. Its error locations are in unchanged `prisma/seed.ts`, admin/dashboard/dosen UI files, outside this AI change. Targeted AI lint is a separate check and must not be presented as repository-wide lint success.

The CI workflow runs baseline reproduction, tests, PDF/OCR, typecheck, targeted lint, build and evaluator dry-run without Gemini or database secrets. Its hosted execution has not been observed until the branch is pushed and CI runs.

## Coverage and limits

The tests verify serialized Gemini request payloads, vector shape, provider setup/read deadlines, cancellation, incomplete output handling, full evidence in prompts, follow-up ordering, course/selected-material query constraints, model/dimension readiness, social/no-evidence fallbacks, citation selection/identity, and failed-turn cleanup. Storage behavior is mocked in service tests; actual database transaction/authorization integration still needs the development environment.

The collector is tested against a local HTTP stub and always leaves content scores unassessed. The 25-question live benchmark and S1/S2/S3 avatar/chat matrix remain pending credentials and application setup. See [evaluation.md](evaluation.md) for scoring and reprocessing steps.

## Admin branch compatibility check

At implementation revision `b295718`, `git merge-tree --write-tree HEAD origin/feat/admin` exited 0 against admin head `85fe17f`, producing merge tree `15dc0180e54dea1159e79428737192ec29dd50d8` with no textual conflicts. This is a merge simulation only: the admin branch was not checked out or merged, and its runtime/migrations/tests were not validated as part of this result.

Local runtime: Node v22.23.1, pnpm 11.9.0, frozen lockfile. The production build and tests were run without live service credentials. Test HTTP responses and DB behavior are explicitly synthetic.
