ALTER TABLE "ai_message_feedback"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "reviewRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reviewerId" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD CONSTRAINT "ai_message_feedback_review_status_check" CHECK ("reviewStatus" IN ('pending', 'in_review', 'completed', 'withdrawn'));
UPDATE "ai_message_feedback" SET "reviewStatus" = 'withdrawn' WHERE "value" = 'positive';
CREATE INDEX "ai_message_feedback_value_reviewStatus_updatedAt_idx" ON "ai_message_feedback"("value", "reviewStatus", "updatedAt");
CREATE TABLE "ai_feedback_review_event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "feedbackId" TEXT NOT NULL REFERENCES "ai_message_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "revision" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "actorName" TEXT,
  "feedbackBefore" JSONB,
  "feedbackAfter" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ai_feedback_review_event_feedbackId_revision_key" ON "ai_feedback_review_event"("feedbackId", "revision");
