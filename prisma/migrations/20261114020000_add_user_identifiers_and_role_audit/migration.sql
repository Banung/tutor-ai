-- Add staff identifiers. Existing rows stay NULL; no backfill.
ALTER TABLE "user" ADD COLUMN "nip" TEXT;
ALTER TABLE "user" ADD COLUMN "nidn" TEXT;

CREATE UNIQUE INDEX "user_nip_key" ON "user"("nip");
CREATE UNIQUE INDEX "user_nidn_key" ON "user"("nidn");

-- CreateTable
CREATE TABLE "user_role_audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromRole" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_role_audit_userId_createdAt_idx" ON "user_role_audit"("userId", "createdAt");
