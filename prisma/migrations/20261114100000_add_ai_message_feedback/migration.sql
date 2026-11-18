CREATE TABLE "ai_message_feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "messageId" TEXT NOT NULL REFERENCES "ai_chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "runId" TEXT REFERENCES "ai_response_run"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "value" TEXT NOT NULL CHECK ("value" IN ('positive', 'negative')),
  "reason" TEXT CHECK ("reason" IN ('incorrect', 'unclear', 'sources', 'other')),
  "note" TEXT CHECK (char_length("note") <= 500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ai_message_feedback_userId_messageId_key" ON "ai_message_feedback"("userId", "messageId");
CREATE INDEX "ai_message_feedback_runId_idx" ON "ai_message_feedback"("runId");
