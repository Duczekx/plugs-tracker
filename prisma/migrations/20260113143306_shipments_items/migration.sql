/*
  Warnings:

  - You are about to drop the column `isSchwenkbock` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `variant` on the `Shipment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ValveType" AS ENUM ('NONE', 'SMALL', 'LARGE');

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "isSchwenkbock",
DROP COLUMN "model",
DROP COLUMN "quantity",
DROP COLUMN "serialNumber",
DROP COLUMN "variant";

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "model" "Model" NOT NULL DEFAULT 'FL_540',
    "serialNumber" INTEGER NOT NULL DEFAULT 0,
    "variant" "Variant" NOT NULL,
    "isSchwenkbock" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "buildDate" TIMESTAMP(3) NOT NULL,
    "bucketHolder" BOOLEAN NOT NULL DEFAULT false,
    "valveType" "ValveType" NOT NULL DEFAULT 'NONE',
    "extraParts" TEXT,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
