CREATE TABLE "ai_answer_correction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "feedbackId" TEXT REFERENCES "ai_message_feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "questionKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "answer" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','approved','withdrawn','superseded')),
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedByName" TEXT,
  "approvedAt" TIMESTAMP(3),
  "withdrawnBy" TEXT,
  "withdrawnByName" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "withdrawalReason" TEXT,
  "supersededById" TEXT,
  "embeddingModel" TEXT,
  "embeddingDimensions" INTEGER,
  "questionEmbedding" vector(768),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ai_answer_correction_courseId_questionKey_version_key" ON "ai_answer_correction"("courseId","questionKey","version");
CREATE UNIQUE INDEX "ai_answer_correction_one_approved_question" ON "ai_answer_correction"("courseId","questionKey") WHERE "status" = 'approved';
CREATE INDEX "ai_answer_correction_courseId_status_idx" ON "ai_answer_correction"("courseId","status");
CREATE INDEX "ai_answer_correction_feedbackId_idx" ON "ai_answer_correction"("feedbackId");
