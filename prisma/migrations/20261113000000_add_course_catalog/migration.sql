-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "faculty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_program" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_program_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculty_name_key" ON "faculty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "study_program_facultyId_name_key" ON "study_program"("facultyId", "name");

-- CreateIndex
CREATE INDEX "study_program_facultyId_idx" ON "study_program"("facultyId");

-- AddForeignKey
ALTER TABLE "study_program" ADD CONSTRAINT "study_program_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "course"
ADD COLUMN "studyProgramId" TEXT,
ADD COLUMN "courseCode" TEXT,
ADD COLUMN "learningOutcomes" TEXT,
ADD COLUMN "coverStoragePath" TEXT,
ADD COLUMN "hasArModule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "catalogStatus" "CatalogStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: legacy active courses were visible/accepted by student discovery, keep them published.
-- Legacy inactive courses start as drafts. No other catalog metadata is fabricated.
UPDATE "course" SET "catalogStatus" = 'PUBLISHED' WHERE "isActive" = true;

-- CreateIndex
CREATE UNIQUE INDEX "course_studyProgramId_courseCode_key" ON "course"("studyProgramId", "courseCode");

-- CreateIndex
CREATE INDEX "course_catalogStatus_idx" ON "course"("catalogStatus");

-- CreateIndex
CREATE INDEX "course_studyProgramId_idx" ON "course"("studyProgramId");

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_studyProgramId_fkey" FOREIGN KEY ("studyProgramId") REFERENCES "study_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Normalized course codes are enforced at the database boundary as well as in the application.
ALTER TABLE "course" ADD CONSTRAINT "course_courseCode_normalized_check" CHECK (
    "courseCode" IS NULL OR (
        "courseCode" = btrim(upper("courseCode")) AND
        "courseCode" ~ '^[A-Z0-9]{4,12}$'
    )
);
