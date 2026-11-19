-- Correct the replayed application schema so a clean migration chain matches prisma/schema.prisma.
-- This migration is only meaningful for clean replay: the historical SQL above it creates
-- tutor_prompt_config nowhere and uses ON DELETE RESTRICT for five foreign keys.

-- CreateTable
CREATE TABLE "tutor_prompt_config" (
    "id" TEXT NOT NULL,
    "academicLevel" TEXT NOT NULL,
    "responseMode" TEXT NOT NULL,
    "promptContent" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_prompt_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_prompt_config_academicLevel_responseMode_key" ON "tutor_prompt_config"("academicLevel", "responseMode");

-- Converge historical RESTRICT foreign keys to current Prisma schema Cascade behavior.
ALTER TABLE "course" DROP CONSTRAINT "course_createdBy_fkey";
ALTER TABLE "course" ADD CONSTRAINT "course_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_session" DROP CONSTRAINT "course_session_createdBy_fkey";
ALTER TABLE "course_session" ADD CONSTRAINT "course_session_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material" DROP CONSTRAINT "material_uploadedBy_fkey";
ALTER TABLE "material" ADD CONSTRAINT "material_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_chat_session" DROP CONSTRAINT "ai_chat_session_courseId_fkey";
ALTER TABLE "ai_chat_session" ADD CONSTRAINT "ai_chat_session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_chat_session" DROP CONSTRAINT "ai_chat_session_courseSessionId_fkey";
ALTER TABLE "ai_chat_session" ADD CONSTRAINT "ai_chat_session_courseSessionId_fkey" FOREIGN KEY ("courseSessionId") REFERENCES "course_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
