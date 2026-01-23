import {
  BomConfiguration,
  Model,
  Prisma,
  ShipmentExtraItem,
  ShipmentItem,
  ValveType,
} from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type StockWarning = {
  partId: number;
  name: string;
  stock: number;
};

export type PartsSummary = {
  requiredByPartId: Map<number, number>;
  missingBom: Array<{ modelName: string; configuration: BomConfiguration }>;
  unmatchedExtras: string[];
};

const modelNameMap: Record<Model, string> = {
  FL_640: "FL 640",
  FL_540: "FL 540",
  FL_470: "FL 470",
  FL_400: "FL 400",
  FL_340: "FL 340",
  FL_260: "FL 260",
};

const hasValve = (valveType: ValveType) => valveType !== "NONE";

export const getModelName = (model: Model) => modelNameMap[model];

export const getConfiguration = (item: Pick<ShipmentItem, "configuration" | "isSchwenkbock" | "valveType">) => {
  if (item.configuration) {
    return item.configuration;
  }
  if (item.isSchwenkbock && hasValve(item.valveType)) {
    return BomConfiguration.SCHWENKBOCK_6_2;
  }
  if (item.isSchwenkbock) {
    return BomConfiguration.SCHWENKBOCK;
  }
  if (hasValve(item.valveType)) {
    return BomConfiguration.STANDARD_6_2;
  }
  return BomConfiguration.STANDARD;
};

export const buildPartsSummary = async (
  tx: TxClient,
  items: ShipmentItem[],
  extras: ShipmentExtraItem[]
): Promise<PartsSummary> => {
  const requiredByPartId = new Map<number, number>();
  const missingBom: Array<{ modelName: string; configuration: BomConfiguration }> = [];

  const bomKeys = items.map((item) => ({
    modelName: getModelName(item.model),
    configuration: getConfiguration(item),
  }));
  const bomLookup = new Map<string, { items: { partId: number; qtyPerPlow: number }[] }>();

  if (bomKeys.length > 0) {
    const boms = await tx.bom.findMany({
      where: {
        OR: bomKeys.map((key) => ({
          modelName: key.modelName,
          configuration: key.configuration,
        })),
      },
      include: { items: true },
    });
    boms.forEach((bom) => {
      const key = `${bom.modelName}::${bom.configuration}`;
      bomLookup.set(key, { items: bom.items });
    });
  }

  items.forEach((item) => {
    const modelName = getModelName(item.model);
    const configuration = getConfiguration(item);
    const key = `${modelName}::${configuration}`;
    const bom = bomLookup.get(key);
    if (!bom) {
      missingBom.push({ modelName, configuration });
      return;
    }
    bom.items.forEach((bomItem) => {
      const delta = bomItem.qtyPerPlow * item.quantity;
      requiredByPartId.set(
        bomItem.partId,
        (requiredByPartId.get(bomItem.partId) ?? 0) + delta
      );
    });
  });

  const extrasWithNames = extras.filter((extra) => !extra.partId && extra.name);
  const unmatchedExtras: string[] = [];

  if (extrasWithNames.length > 0) {
    const nameQueries = extrasWithNames.map((extra) => ({
      name: { equals: extra.name, mode: "insensitive" as const },
    }));
    const parts = await tx.part.findMany({
      where: {
        OR: nameQueries,
      },
    });
    const partByName = new Map(
      parts.map((part) => [part.name.toLowerCase(), part.id])
    );
    extras.forEach((extra) => {
      const partId =
        extra.partId ??
        (extra.name ? partByName.get(extra.name.toLowerCase()) ?? null : null);
      if (!partId) {
        if (extra.name) {
          unmatchedExtras.push(extra.name);
        }
        return;
      }
      requiredByPartId.set(
        partId,
        (requiredByPartId.get(partId) ?? 0) + extra.quantity
      );
    });
  } else {
    extras.forEach((extra) => {
      if (!extra.partId) {
        return;
      }
      requiredByPartId.set(
        extra.partId,
        (requiredByPartId.get(extra.partId) ?? 0) + extra.quantity
      );
    });
  }

  return { requiredByPartId, missingBom, unmatchedExtras };
};

export const applyShipmentPartDeltas = async (
  tx: TxClient,
  shipmentId: number,
  deltaByPartId: Map<number, number>
) => {
  const warnings: StockWarning[] = [];

  for (const [partId, delta] of deltaByPartId.entries()) {
    if (!delta) {
      continue;
    }
    const updated = await tx.part.update({
      where: { id: partId },
      data: { stock: { increment: delta } },
      select: { id: true, name: true, stock: true },
    });

    await tx.partMovement.create({
      data: {
        partId,
        delta,
        reason: delta < 0 ? "READY_SHIPMENT" : "ROLLBACK_SHIPMENT",
        shipmentId,
      },
    });

    if (updated.stock < 0) {
      warnings.push({ partId: updated.id, name: updated.name, stock: updated.stock });
    }
  }

  return warnings;
};

export const calculateShipmentDelta = async (
  tx: TxClient,
  shipmentId: number,
  requiredByPartId: Map<number, number>
) => {
  const existing = await tx.partMovement.findMany({
    where: {
      shipmentId,
      reason: { in: ["READY_SHIPMENT", "ROLLBACK_SHIPMENT"] },
    },
    select: { partId: true, delta: true },
  });

  const appliedByPartId = new Map<number, number>();
  existing.forEach((movement) => {
    appliedByPartId.set(
      movement.partId,
      (appliedByPartId.get(movement.partId) ?? 0) + movement.delta
    );
  });

  const deltaByPartId = new Map<number, number>();
  const allPartIds = new Set<number>([
    ...requiredByPartId.keys(),
    ...appliedByPartId.keys(),
  ]);

  for (const partId of allPartIds) {
    const desired = -(requiredByPartId.get(partId) ?? 0);
    const applied = appliedByPartId.get(partId) ?? 0;
    const delta = desired - applied;
    if (delta) {
      deltaByPartId.set(partId, delta);
    }
  }

  return deltaByPartId;
};
