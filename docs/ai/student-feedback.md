# Student answer feedback (FB-01–FB-03)

Branch: `feat/student-answer-feedback`, based on local run-tracking commit `394bef9`.

Only students can submit/read their feedback. No admin dashboard, instructor review queue, correction retrieval, or admin/instructor feedback controls are added. The current UI is composed from the existing chat action row and shadcn components. Exact parity with the Figma feedback frame is not verified: both session creation and design-context reads for `sarwr1niFsRtUA9jecjxHv`, node `1:11309`, were denied due to missing edit access. Local design archives exist under the sibling `research/figma-existing` directory.

## Behavior

Completed AI chat answers have helpful/unhelpful controls alongside copy/audio. The dialog allows a rating, optional reason, and optional note up to 500 characters. Saving updates the selected rating; editing reopens saved details. Failures retain the draft and expose a retry button. Streaming or cancelled partial answers have no feedback controls. History includes saved feedback, so reopening/reloading restores it.

`PUT /api/courses/:courseId/tutor/sessions/:sessionId/messages/:messageId/feedback` accepts `{ value: "positive" | "negative", reason?: "incorrect" | "unclear" | "sources" | "other" | null, note?: string | null }`. Unknown properties (including caller-supplied user/run IDs) are rejected. `GET` on the same endpoint reads the owner's feedback or null.

The service checks student role, owned chat/session/course, AI sender type, active course and enrollment. The server resolves the completed run; the client cannot forge it. Existing answers from before run tracking have a nullable run link. A database unique constraint on `(userId, messageId)` and a native scalar upsert prevent duplicate feedback on repeated saves. Concurrent edits use last-write-wins. Message/user deletion cascades to feedback; run deletion clears its optional link. Feedback data is private and responses use `private, no-store`.

## Later manual verification

Apply the run-tracking migration first, then `20261114100000_add_ai_message_feedback` using the project's normal migration process against the development database. No database migration has been executed by this change.

1. As a student, generate a completed answer and submit a rating with/without a reason/note.
2. Reload the chat; confirm the rating/details persist. Change the rating and confirm one record remains.
3. Simulate a failed save; confirm the draft survives and retry works.
4. Check a 500-character note, validation beyond the limit, keyboard navigation, and a narrow/mobile viewport.
5. Verify another student's message, user-authored message, inactive enrollment, and admin/instructor accounts cannot read/write feedback.
6. Confirm feedback references the answer's completed run; old answers can save with no run.

Automated service tests cover upsert/retry, legacy answers, ownership filtering, denied admin/instructor roles, payload validation and limits. They use mocked database operations, not a real database or browser UI. Browser/manual verification is deferred as requested.

Follow-up: the lecturer queue/status/history is implemented separately in [lecturer-feedback-review.md](lecturer-feedback-review.md). The scope and verification above describe the student-feedback base feature.
