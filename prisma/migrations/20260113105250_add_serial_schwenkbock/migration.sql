-- DropIndex
DROP INDEX "InventoryItem_model_variant_key";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "isSchwenkbock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serialNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "isSchwenkbock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serialNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_model_serialNumber_variant_isSchwenkbock_key" ON "InventoryItem"("model", "serialNumber", "variant", "isSchwenkbock");
