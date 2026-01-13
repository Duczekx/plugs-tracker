-- CreateEnum
CREATE TYPE "Model" AS ENUM ('FL_540', 'FL_470', 'FL_400', 'FL_340', 'FL_260');

-- DropIndex
DROP INDEX "InventoryItem_variant_key";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "model" "Model" NOT NULL DEFAULT 'FL_540';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "model" "Model" NOT NULL DEFAULT 'FL_540';

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_model_variant_key" ON "InventoryItem"("model", "variant");
