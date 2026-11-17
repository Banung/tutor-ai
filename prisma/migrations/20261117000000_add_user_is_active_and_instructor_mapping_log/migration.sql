-- Deactivate accounts without deleting them. Existing rows default to active.
ALTER TABLE "user" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "course_instructor_mapping_log" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_instructor_mapping_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_instructor_mapping_log_courseId_createdAt_idx" ON "course_instructor_mapping_log"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "course_instructor_mapping_log_userId_createdAt_idx" ON "course_instructor_mapping_log"("userId", "createdAt");
