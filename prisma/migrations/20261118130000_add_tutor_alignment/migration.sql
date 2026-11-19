ALTER TABLE "course" ADD COLUMN "alignmentAutoRerun" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "tutor_alignment_session" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "includesAllMaterials" BOOLEAN NOT NULL DEFAULT true,
    "materialFingerprint" TEXT NOT NULL,
    "materialSnapshot" JSONB NOT NULL,
    "thresholdPercent" INTEGER NOT NULL DEFAULT 90,
    "academicLevel" TEXT NOT NULL DEFAULT 'S1',
    "responseMode" TEXT NOT NULL DEFAULT 'chat',
    "accuracyPercent" DOUBLE PRECISION,
    "caseCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "autoRerunFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "tutor_alignment_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutor_alignment_case" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'ai',
    "question" TEXT NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "rubric" TEXT,
    "sourceSnapshot" JSONB NOT NULL DEFAULT '[]',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "tutorAnswer" TEXT,
    "verdict" TEXT,
    "grounded" BOOLEAN,
    "scoreReason" TEXT,
    "tutorSources" JSONB NOT NULL DEFAULT '[]',
    "responseTimeMs" INTEGER,
    "correctionDraftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tutor_alignment_case_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tutor_alignment_session_courseId_autoRerunFingerprint_key"
  ON "tutor_alignment_session"("courseId", "autoRerunFingerprint");
CREATE INDEX "tutor_alignment_session_courseId_createdAt_idx"
  ON "tutor_alignment_session"("courseId", "createdAt");
CREATE INDEX "tutor_alignment_session_status_createdAt_idx"
  ON "tutor_alignment_session"("status", "createdAt");
CREATE INDEX "tutor_alignment_case_sessionId_selected_isApproved_idx"
  ON "tutor_alignment_case"("sessionId", "selected", "isApproved");

ALTER TABLE "tutor_alignment_session"
  ADD CONSTRAINT "tutor_alignment_session_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "tutor_alignment_session_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutor_alignment_case"
  ADD CONSTRAINT "tutor_alignment_case_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "tutor_alignment_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
