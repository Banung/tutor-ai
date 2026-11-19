-- CreateTable
CREATE TABLE "course_catalog_status_log" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "CatalogStatus" NOT NULL,
    "toStatus" "CatalogStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_catalog_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_catalog_status_log_courseId_createdAt_idx" ON "course_catalog_status_log"("courseId", "createdAt");
