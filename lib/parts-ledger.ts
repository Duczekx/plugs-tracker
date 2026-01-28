import {
  BomType,
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
  missingBom: Array<{ modelName: string; bomType: BomType }>;
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

const schwenk3000Models = new Set<Model>([
  "FL_640",
  "FL_540",
  "FL_470",
  "FL_400",
]);
const schwenk2000Models = new Set<Model>(["FL_340", "FL_260"]);

const getSchwenkbockType = (model: Model): BomType => {
  if (schwenk3000Models.has(model)) {
    return "SCHWENKBOCK_3000";
  }
  if (schwenk2000Models.has(model)) {
    return "SCHWENKBOCK_2000";
  }
  return "SCHWENKBOCK_2000";
};

type BomLookup = Map<
  string,
  { items: { partId: number; qtyPerPlow: number }[] }
>;

type BomKey = { modelName: string; bomType: BomType };

const buildBomKey = (modelName: string, bomType: BomType) =>
  `${modelName}::${bomType}`;

export const getPartsForPlow = (
  model: Model,
  hasSchwenkbock: boolean,
  hasSixTwo: boolean,
  bomLookup: BomLookup
) => {
  const requiredByPartId = new Map<number, number>();
  const missingBom: BomKey[] = [];
  const modelName = getModelName(model);

  const requiredKeys: BomKey[] = [
    { modelName, bomType: "STANDARD" },
  ];

  if (hasSixTwo) {
    requiredKeys.push({ modelName, bomType: "ADDON_6_2" });
  }

  if (hasSchwenkbock) {
    requiredKeys.push({ modelName: "GLOBAL", bomType: getSchwenkbockType(model) });
  }

  requiredKeys.forEach((key) => {
    const bom = bomLookup.get(buildBomKey(key.modelName, key.bomType));
    if (!bom) {
      missingBom.push(key);
      return;
    }
    bom.items.forEach((item) => {
      requiredByPartId.set(
        item.partId,
        (requiredByPartId.get(item.partId) ?? 0) + item.qtyPerPlow
      );
    });
  });

  return { requiredByPartId, missingBom };
};

export const buildPartsSummary = async (
  tx: TxClient,
  items: ShipmentItem[],
  extras: ShipmentExtraItem[]
): Promise<PartsSummary> => {
  const requiredByPartId = new Map<number, number>();
  const missingBom: BomKey[] = [];

  const bomKeys = new Map<string, BomKey>();
  items.forEach((item) => {
    const modelName = getModelName(item.model);
    const hasSixTwo = hasValve(item.valveType);
    bomKeys.set(buildBomKey(modelName, "STANDARD"), {
      modelName,
      bomType: "STANDARD",
    });
    if (hasSixTwo) {
      bomKeys.set(buildBomKey(modelName, "ADDON_6_2"), {
        modelName,
        bomType: "ADDON_6_2",
      });
    }
    if (item.isSchwenkbock) {
      const schwenkType = getSchwenkbockType(item.model);
      bomKeys.set(buildBomKey("GLOBAL", schwenkType), {
        modelName: "GLOBAL",
        bomType: schwenkType,
      });
    }
  });

  const bomLookup: BomLookup = new Map();
  if (bomKeys.size > 0) {
    const boms = await tx.bom.findMany({
      where: {
        OR: Array.from(bomKeys.values()).map((key) => ({
          modelName: key.modelName,
          bomType: key.bomType,
        })),
      },
      include: { items: true },
    });
    boms.forEach((bom) => {
      bomLookup.set(buildBomKey(bom.modelName, bom.bomType), { items: bom.items });
    });
  }

  items.forEach((item) => {
    const hasSixTwo = hasValve(item.valveType);
    const { requiredByPartId: partsForPlow, missingBom: missingForPlow } =
      getPartsForPlow(item.model, item.isSchwenkbock, hasSixTwo, bomLookup);

    missingForPlow.forEach((missing) => missingBom.push(missing));

    partsForPlow.forEach((qtyPerPlow, partId) => {
      const delta = qtyPerPlow * item.quantity;
      requiredByPartId.set(partId, (requiredByPartId.get(partId) ?? 0) + delta);
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
        isArchived: false,
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
