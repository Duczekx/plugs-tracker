const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the production ledger with an in-memory BOM, without connecting to a database.
const source = fs.readFileSync("lib/parts-ledger.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject, require, console, Map, Set });
const { getPartsForPlow, buildPartsSummary, calculateShipmentDelta } = exportsObject;
const lookup = new Map([
  ["FL540::STANDARD", { items: [{ partId: 1, qtyPerPlow: 2 }] }],
  ["83::ADDON_8_3", { items: [{ partId: 2, qtyPerPlow: 1 }] }],
  ["62SCHWARZ::ADDON_6_2", { items: [{ partId: 3, qtyPerPlow: 1 }] }],
  ["62GRAU::ADDON_6_2", { items: [{ partId: 4, qtyPerPlow: 1 }] }],
  ["GLOBAL::SCHWENKBOCK_3000", { items: [{ partId: 5, qtyPerPlow: 3 }] }],
]);
for (const [valve, partId] of [["EIGHT_THREE", 2], ["LARGE", 3], ["SMALL", 4]]) {
  const result = getPartsForPlow("FL_540", true, valve, lookup);
  assert.equal(result.missingBom.length, 0);
  assert.deepEqual([...result.requiredByPartId], [[1, 2], [partId, 1], [5, 3]]);
}
assert.deepEqual([...getPartsForPlow("FL_540", false, "NONE", lookup).requiredByPartId], [[1, 2]]);
assert.equal(getPartsForPlow("FL_540", false, "EIGHT_THREE", new Map()).missingBom.length, 2);

(async () => {
  let requestedTypes;
  const tx = {
    bom: { findMany: async ({ where }) => {
      requestedTypes = where.bomType.in;
      return [
        { modelName: "FL 540", bomType: "STANDARD", items: [{ partId: 1, qtyPerPlow: 2 }] },
        { modelName: "8/3", bomType: "ADDON_8_3", items: [{ partId: 2, qtyPerPlow: 1 }] },
      ];
    } },
    partMovement: { findMany: async () => [{ partId: 1, delta: -4 }, { partId: 2, delta: -2 }] },
  };
  const summary = await buildPartsSummary(tx, [{ model: "FL_540", isSchwenkbock: false, valveType: "EIGHT_THREE", quantity: 2 }], [{ partId: 6, quantity: 3 }]);
  assert.deepEqual(Array.from(requestedTypes), ["STANDARD", "ADDON_8_3"]);
  assert.deepEqual([...summary.requiredByPartId], [[1, 4], [2, 2], [6, 3]]);
  assert.deepEqual([...await calculateShipmentDelta(tx, 1, summary.requiredByPartId)], [[6, -3]]);
  assert.deepEqual([...await calculateShipmentDelta(tx, 1, new Map())], [[1, 4], [2, 2]]);
  console.log("PASS: 8/3 and existing 6/2 BOM selection, quantities, extras, repeat deductions and rollback");
})().catch(error => { console.error(error); process.exitCode = 1; });
