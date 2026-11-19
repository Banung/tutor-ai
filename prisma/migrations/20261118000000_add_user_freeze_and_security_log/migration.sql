-- Freeze accounts without deleting them. Existing rows default to not frozen.
ALTER TABLE "user" ADD COLUMN "isFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "frozenAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "frozenReason" TEXT;

-- CreateTable
CREATE TABLE "user_security_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "revokedSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_security_log_userId_createdAt_idx" ON "user_security_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_security_log_actorId_createdAt_idx" ON "user_security_log"("actorId", "createdAt");
