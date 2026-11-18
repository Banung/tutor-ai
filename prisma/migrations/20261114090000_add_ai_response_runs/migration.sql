CREATE TABLE "ai_response_run" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "aiChatSessionId" TEXT NOT NULL REFERENCES "ai_chat_session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL,
  "retryOfRunId" TEXT,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "stage" TEXT NOT NULL DEFAULT 'retrieval',
  "question" TEXT NOT NULL,
  "responseMode" TEXT NOT NULL,
  "userMessageId" TEXT,
  "answerMessageId" TEXT,
  "configuration" JSONB,
  "evidence" JSONB,
  "tokenUsage" JSONB,
  "errorCategory" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  CONSTRAINT "ai_response_run_status_check" CHECK ("status" IN ('running', 'completed', 'failed', 'cancelled', 'timed_out')),
  CONSTRAINT "ai_response_run_stage_check" CHECK ("stage" IN ('retrieval', 'generation', 'persistence'))
);
CREATE UNIQUE INDEX "ai_response_run_aiChatSessionId_requestId_key" ON "ai_response_run"("aiChatSessionId", "requestId");
CREATE UNIQUE INDEX "ai_response_run_answerMessageId_key" ON "ai_response_run"("answerMessageId");
CREATE INDEX "ai_response_run_aiChatSessionId_startedAt_idx" ON "ai_response_run"("aiChatSessionId", "startedAt");
