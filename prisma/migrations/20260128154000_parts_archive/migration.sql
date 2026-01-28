ALTER TABLE "Part"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Part_isArchived_idx" ON "Part"("isArchived");
