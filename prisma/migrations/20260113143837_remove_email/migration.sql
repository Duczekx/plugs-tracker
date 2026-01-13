/*
  Warnings:

  - You are about to drop the column `email` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "email",
DROP COLUMN "phone";
