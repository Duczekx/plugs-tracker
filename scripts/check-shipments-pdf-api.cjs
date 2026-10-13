const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");
let blocked = true, queried = 0, captured;
const shipments = [{ id: 1, status: "READY", companyName: "Firma", firstName: "Jan", lastName: "Kowalski", items: [{ buildNumber: "123" }], extras: [] },
  { id: 2, status: "SENT", companyName: "Inna", firstName: "Anna", lastName: "Nowak", items: [{ buildNumber: "456" }], extras: [] },
  { id: 3, status: "RESERVED", companyName: "Firma", firstName: "Jan", lastName: "Kowalski", items: [{ buildNumber: "123" }], extras: [] }];
const exp = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("app/api/shipments/pdf/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exp, Uint8Array, console, require: name => {
  if (name === "next/server") return { NextResponse };
  if (name === "@/lib/role-auth") return { requireRole: async () => blocked ? NextResponse.json({}, { status: 401 }) : null };
  if (name === "@/lib/db") return { prisma: { shipment: { findMany: async ({ where }) => { queried++; return shipments.filter(s => where.status.in.includes(s.status) && (!where.items || s.items.some(i => i.buildNumber.includes(where.items.some.buildNumber.contains)))); } } } };
  if (name === "@/lib/shipments-pdf") return { buildShipmentsPdf: async (s, options) => { captured = { s, options }; return Buffer.from("%PDF"); } };
  throw new Error(name);
} });
(async () => {
  const request = query => new NextRequest(`https://example.test/api/shipments/pdf?${query}`);
  assert.equal((await exp.GET(request("mode=all"))).status, 401);
  assert.equal(queried, 0);
  blocked = false;
  assert.equal((await exp.GET(request("mode=invalid"))).status, 400);
  assert.equal(queried, 0);
  const response = await exp.GET(request("mode=ready&lang=pl&company=Jan%20Kowalski&buildNumber=123"));
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(captured.s.length, 1);
  assert.equal(captured.s[0].id, 1);
  assert.equal(captured.options.lang, "pl");
  await exp.GET(request("mode=sent&lang=de"));
  assert.equal(captured.s[0].id, 2);
  assert.equal(captured.options.lang, "de");
  await exp.GET(request("mode=all"));
  assert.deepEqual(captured.s.map(s => s.id), [1, 2]);
  console.log("PASS: PDF authentication, invalid mode, READY/SENT isolation, filters and PL/DE selection");
})().catch(error => { console.error(error); process.exitCode = 1; });
