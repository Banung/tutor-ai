-- The prompt editor/model predated its migration. Preserve any table/customizations
-- previously created outside migration history; create the missing table on fresh databases.
CREATE TABLE IF NOT EXISTS "tutor_prompt_config" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "academicLevel" TEXT NOT NULL,
  "responseMode" TEXT NOT NULL,
  "promptContent" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_prompt_config_academicLevel_responseMode_key"
  ON "tutor_prompt_config"("academicLevel", "responseMode");
