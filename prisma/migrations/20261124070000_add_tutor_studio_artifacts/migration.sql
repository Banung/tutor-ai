-- CreateEnum
CREATE TYPE "TutorStudioArtifactType" AS ENUM ('SUMMARY', 'QUIZ', 'FLASHCARDS', 'NOTE');

-- CreateTable
CREATE TABLE "tutor_studio_artifact" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatSessionId" TEXT,
    "sourceMessageId" TEXT,
    "type" "TutorStudioArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "materialIds" JSONB NOT NULL DEFAULT '[]',
    "materialTitles" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_studio_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_studio_artifact_courseId_userId_updatedAt_idx" ON "tutor_studio_artifact"("courseId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "tutor_studio_artifact_courseId_userId_chatSessionId_updated_idx" ON "tutor_studio_artifact"("courseId", "userId", "chatSessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "tutor_studio_artifact_sourceMessageId_idx" ON "tutor_studio_artifact"("sourceMessageId");

-- AddForeignKey
ALTER TABLE "tutor_studio_artifact" ADD CONSTRAINT "tutor_studio_artifact_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_studio_artifact" ADD CONSTRAINT "tutor_studio_artifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_studio_artifact" ADD CONSTRAINT "tutor_studio_artifact_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ai_chat_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
