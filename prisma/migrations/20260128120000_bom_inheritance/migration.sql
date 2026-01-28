CREATE TYPE "BomType" AS ENUM (
  'STANDARD',
  'ADDON_6_2',
  'SCHWENKBOCK_3000',
  'SCHWENKBOCK_2000'
);

ALTER TABLE "Bom"
ADD COLUMN "bomType" "BomType";

UPDATE "Bom"
SET "bomType" = CASE
  WHEN "configuration" = 'STANDARD' THEN 'STANDARD'::"BomType"
  WHEN "configuration" = 'STANDARD_6_2' THEN 'ADDON_6_2'::"BomType"
  WHEN "configuration" IN ('SCHWENKBOCK', 'SCHWENKBOCK_6_2') THEN
    CASE
      WHEN "modelName" IN ('FL 640', 'FL 540', 'FL 470', 'FL 400') THEN 'SCHWENKBOCK_3000'::"BomType"
      ELSE 'SCHWENKBOCK_2000'::"BomType"
    END
  ELSE 'STANDARD'::"BomType"
END;

DELETE FROM "Bom" b
USING "Bom" b2
WHERE b.id > b2.id
  AND b.bomType = b2.bomType
  AND b.bomType IN ('SCHWENKBOCK_3000', 'SCHWENKBOCK_2000');

UPDATE "Bom"
SET "modelName" = 'GLOBAL'
WHERE "bomType" IN ('SCHWENKBOCK_3000', 'SCHWENKBOCK_2000');

ALTER TABLE "Bom"
ALTER COLUMN "bomType" SET NOT NULL;

DROP INDEX IF EXISTS "Bom_modelName_configuration_key";

ALTER TABLE "Bom"
DROP COLUMN "configuration";

CREATE UNIQUE INDEX "Bom_modelName_bomType_key" ON "Bom"("modelName", "bomType");
