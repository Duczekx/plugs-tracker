const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync("lib/shipments-pdf.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const exp = {};
vm.runInNewContext(source, { exports: exp, require, process, Buffer, console });
const out = process.argv[2];
if (!out) throw new Error("Usage: node scripts/check-shipments-pdf.cjs <preview-directory>");
fs.mkdirSync(out, { recursive: true });
const item = { model: "FL_540", serialNumber: 2716, buildNumber: "BAU-2026-101", buildDate: new Date("2026-10-10T00:00:00Z"),
  variant: "ZINC", isSchwenkbock: true, valveType: "EIGHT_THREE", bucketHolder: true, quantity: 2, extraParts: "Dodatkowe oświetlenie / Zusatzbeleuchtung" };
const order = { id: 101, status: "READY", companyName: "Müller & Söhne - Zakład usług komunalnych", firstName: "Łukasz", lastName: "Żółć", street: "Długa 15", postalCode: "01-234", city: "Łódź", country: "Polska", notes: "Odbiór po uzgodnieniu terminu. Lieferung nach Terminvereinbarung.", items: [item], extras: [{ name: "Hydraulikschlauch 2500 mm", quantity: 4, note: "Dołączyć do zamówienia" }] };
(async () => {
  for (const lang of ["pl", "de"]) {
    const orders = [order, { ...order, id: 102, status: "SENT", items: [{ ...item, valveType: "SMALL", buildNumber: "BAU-2026-102" }] }];
    const buffer = await exp.buildShipmentsPdf(orders, { mode: "all", lang, now: new Date("2026-10-13T10:00:00Z") });
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    fs.writeFileSync(path.join(out, `shipments-${lang}.pdf`), buffer);
  }
  const stress = Array.from({ length: 18 }, (_, i) => ({ ...order, id: 200 + i,
    status: i % 2 ? "SENT" : "READY", items: [{ ...item, buildNumber: `LONG-${i}-` + "ABC".repeat(50), extraParts: "Wyposażenie dodatkowe. ".repeat(20) }], notes: "Notatka dotycząca dostawy. ".repeat(20) }));
  fs.writeFileSync(path.join(out, "shipments-stress.pdf"), await exp.buildShipmentsPdf(stress, { mode: "all", lang: "pl" }));
  fs.writeFileSync(path.join(out, "shipments-empty.pdf"), await exp.buildShipmentsPdf([], { mode: "all", lang: "pl" }));
  for (const mode of ["ready", "sent"]) fs.writeFileSync(path.join(out, `shipments-${mode}.pdf`), await exp.buildShipmentsPdf([order, { ...order, status: "SENT", id: 102 }], { mode, lang: "pl" }));
  console.log("PASS: combined PL/DE, individual statuses, empty and multi-page shipment reports generated");
})().catch(error => { console.error(error); process.exitCode = 1; });
