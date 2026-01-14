-- CreateTable
CREATE TABLE "ShipmentExtraItem" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentExtraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentExtraItem_shipmentId_idx" ON "ShipmentExtraItem"("shipmentId");

-- AddForeignKey
ALTER TABLE "ShipmentExtraItem" ADD CONSTRAINT "ShipmentExtraItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
