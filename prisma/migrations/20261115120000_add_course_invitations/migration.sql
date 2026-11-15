CREATE TABLE "course_invitation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_invitation_courseId_key" ON "course_invitation"("courseId");
CREATE UNIQUE INDEX "course_invitation_tokenHash_key" ON "course_invitation"("tokenHash");
ALTER TABLE "course_invitation" ADD CONSTRAINT "course_invitation_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
