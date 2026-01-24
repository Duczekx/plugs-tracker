CREATE TYPE "BomConfiguration" AS ENUM (
  'STANDARD',
  'STANDARD_6_2',
  'SCHWENKBOCK',
  'SCHWENKBOCK_6_2'
);

CREATE TYPE "PartMovementReason" AS ENUM (
  'READY_SHIPMENT',
  'ROLLBACK_SHIPMENT',
  'MANUAL_ADJUST'
);

ALTER TYPE "ShipmentStatus" ADD VALUE 'RESERVED';

ALTER TABLE "ShipmentItem"
ADD COLUMN IF NOT EXISTS "configuration" "BomConfiguration" NOT NULL DEFAULT 'STANDARD'::"BomConfiguration";

UPDATE "ShipmentItem"
SET "configuration" = (
  CASE
    WHEN "isSchwenkbock" = TRUE AND "valveType" <> 'NONE' THEN 'SCHWENKBOCK_6_2'
    WHEN "isSchwenkbock" = TRUE THEN 'SCHWENKBOCK'
    WHEN "valveType" <> 'NONE' THEN 'STANDARD_6_2'
    ELSE 'STANDARD'
  END
)::"BomConfiguration";

CREATE TABLE "Part" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'szt',
  "stock" INTEGER NOT NULL DEFAULT 0,
  "shopUrl" TEXT,
  "shopName" TEXT,
  "warningThreshold" INTEGER,
  "criticalThreshold" INTEGER,
  CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Part_name_key" ON "Part"("name");
CREATE INDEX "Part_name_idx" ON "Part"("name");
CREATE INDEX "Part_stock_idx" ON "Part"("stock");

CREATE TABLE "Bom" (
  "id" SERIAL NOT NULL,
  "modelName" TEXT NOT NULL,
  "configuration" "BomConfiguration" NOT NULL,
  CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Bom_modelName_configuration_key" ON "Bom"("modelName", "configuration");

CREATE TABLE "BomItem" (
  "id" SERIAL NOT NULL,
  "bomId" INTEGER NOT NULL,
  "partId" INTEGER NOT NULL,
  "qtyPerPlow" INTEGER NOT NULL,
  CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BomItem_bomId_partId_key" ON "BomItem"("bomId", "partId");

ALTER TABLE "BomItem"
ADD CONSTRAINT "BomItem_bomId_fkey"
FOREIGN KEY ("bomId") REFERENCES "Bom"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BomItem"
ADD CONSTRAINT "BomItem_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentExtraItem"
ADD COLUMN "partId" INTEGER;

CREATE INDEX "ShipmentExtraItem_partId_idx" ON "ShipmentExtraItem"("partId");

ALTER TABLE "ShipmentExtraItem"
ADD CONSTRAINT "ShipmentExtraItem_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PartMovement" (
  "id" SERIAL NOT NULL,
  "partId" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "PartMovementReason" NOT NULL,
  "shipmentId" INTEGER,
  "note" TEXT,
  "actor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartMovement_createdAt_idx" ON "PartMovement"("createdAt");
CREATE INDEX "PartMovement_partId_idx" ON "PartMovement"("partId");
CREATE INDEX "PartMovement_shipmentId_idx" ON "PartMovement"("shipmentId");
CREATE INDEX "PartMovement_reason_idx" ON "PartMovement"("reason");

ALTER TABLE "PartMovement"
ADD CONSTRAINT "PartMovement_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartMovement"
ADD CONSTRAINT "PartMovement_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
