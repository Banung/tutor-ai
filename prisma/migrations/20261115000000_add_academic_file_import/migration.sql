-- FR-005 file import: additive only. Existing rows keep NULL codes/source.

CREATE TYPE "AcademicSource" AS ENUM ('SIAT', 'PIPP');
CREATE TYPE "AcademicImportType" AS ENUM ('STUDY_PROGRAMS', 'COURSES', 'LECTURERS');
CREATE TYPE "AcademicImportStatus" AS ENUM ('PREVIEWED', 'CONFIRMING', 'CONFIRMED', 'PARTIAL', 'FAILED', 'EXPIRED');
CREATE TYPE "AcademicImportAction" AS ENUM ('CREATED', 'UPDATED', 'UNCHANGED', 'FAILED', 'CONFLICT');

ALTER TABLE "faculty" ADD COLUMN "code" TEXT;
ALTER TABLE "faculty" ADD COLUMN "source" "AcademicSource";
ALTER TABLE "faculty" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "faculty_code_key" ON "faculty"("code");

ALTER TABLE "study_program" ADD COLUMN "code" TEXT;
ALTER TABLE "study_program" ADD COLUMN "source" "AcademicSource";
ALTER TABLE "study_program" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "study_program_facultyId_code_key" ON "study_program"("facultyId", "code");

CREATE TABLE "academic_course_reference" (
    "id" TEXT NOT NULL,
    "studyProgramId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "AcademicSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_course_reference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_course_reference_studyProgramId_courseCode_key"
    ON "academic_course_reference"("studyProgramId", "courseCode");
CREATE INDEX "academic_course_reference_studyProgramId_idx"
    ON "academic_course_reference"("studyProgramId");

CREATE TABLE "lecturer_reference" (
    "id" TEXT NOT NULL,
    "nip" TEXT,
    "nidn" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "AcademicSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturer_reference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lecturer_reference_nip_key" ON "lecturer_reference"("nip");
CREATE UNIQUE INDEX "lecturer_reference_nidn_key" ON "lecturer_reference"("nidn");

CREATE TABLE "academic_import_batch" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "source" "AcademicSource" NOT NULL,
    "type" "AcademicImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileDigest" TEXT NOT NULL,
    "status" "AcademicImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "academic_import_batch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_import_batch_createdAt_idx" ON "academic_import_batch"("createdAt");
CREATE INDEX "academic_import_batch_actorId_createdAt_idx" ON "academic_import_batch"("actorId", "createdAt");

CREATE TABLE "academic_import_row_outcome" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "identity" TEXT NOT NULL,
    "action" "AcademicImportAction" NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_import_row_outcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_import_row_outcome_batchId_rowNumber_key"
    ON "academic_import_row_outcome"("batchId", "rowNumber");
CREATE INDEX "academic_import_row_outcome_batchId_action_idx"
    ON "academic_import_row_outcome"("batchId", "action");

ALTER TABLE "academic_course_reference"
    ADD CONSTRAINT "academic_course_reference_studyProgramId_fkey"
    FOREIGN KEY ("studyProgramId") REFERENCES "study_program"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic_import_row_outcome"
    ADD CONSTRAINT "academic_import_row_outcome_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "academic_import_batch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
