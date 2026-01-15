-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('READY', 'SENT');

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "status" "ShipmentStatus" NOT NULL DEFAULT 'READY';
