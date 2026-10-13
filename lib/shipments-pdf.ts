import PDFDocument from "pdfkit";
import path from "node:path";

export type ReportMode = "all" | "ready" | "sent";
export type ReportShipment = {
  id: number; status: string; companyName: string; firstName: string; lastName: string;
  street: string; postalCode: string; city: string; country: string; notes: string | null;
  items: Array<{
    model: string; serialNumber: number; buildNumber: string; buildDate: Date;
    variant: string; isSchwenkbock: boolean; valveType: string; bucketHolder: boolean;
    quantity: number; extraParts: string | null;
  }>;
  extras: Array<{ name: string; quantity: number; note: string | null }>;
};

export const reportLabels = {
  pl: { title: "Raport wysyłek", ready: "Gotowe do wysyłki", sent: "Wysłane", empty: "Brak pługów w tej grupie.", address: "Adres", plow: "Pług",
    customer: "Klient", order: "Zamówienie", model: "Model / nr produktu", build: "Bau-Nr", config: "Konfiguracja", qty: "Ilość", date: "Data budowy",
    zinc: "Ocynk", orange: "Pomarańczowy", none: "Brak", yes: "Tak", no: "Nie", holder: "Uchwyt na wiaderko",
    extras: "Dodatkowe części", notes: "Uwagi", page: "Strona", generated: "Wygenerowano", filters: "Filtry", company: "Firma", plows: "pługów", orders: "zamówień", continued: "ciąg dalszy" },
  de: { title: "Versandbericht", ready: "Versandbereit", sent: "Gesendet", empty: "Keine Schneeschieber in dieser Gruppe.", address: "Adresse", plow: "Schneeschieber",
    customer: "Kunde", order: "Auftrag", model: "Modell / Produkt-Nr.", build: "Bau-Nr", config: "Konfiguration", qty: "Menge", date: "Baudatum",
    zinc: "Verzinkt", orange: "Orange", none: "Keine", yes: "Ja", no: "Nein", holder: "Eimerhalterung",
    extras: "Zusatzteile", notes: "Notizen", page: "Seite", generated: "Erstellt", filters: "Filter", company: "Firma", plows: "Schneeschieber", orders: "Aufträge", continued: "Fortsetzung" },
};

export async function buildShipmentsPdf(shipments: ReportShipment[], options: {
  mode: ReportMode; lang: "pl" | "de"; company?: string; buildNumber?: string; now?: Date;
}) {
  const t = reportLabels[options.lang];
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true,
    font: path.join(process.cwd(), "public/fonts/LiberationSans-Regular.ttf") });
  doc.registerFont("Body", path.join(process.cwd(), "public/fonts/LiberationSans-Regular.ttf"));
  doc.registerFont("Bold", path.join(process.cwd(), "public/fonts/LiberationSans-Bold.ttf"));
  doc.info.Title = t.title;
  doc.info.Author = "Flachenschneeschieber";
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const left = 36, width = doc.page.width - 72, bottom = doc.page.height - 56;
  const columnWidths = [width * 0.58, width * 0.42];
  let y = 36;
  const stamp = (options.now ?? new Date()).toLocaleString(options.lang === "pl" ? "pl-PL" : "de-DE", { timeZone: "Europe/Warsaw" });
  const selected = options.mode === "ready" ? ["READY"] : options.mode === "sent" ? ["SENT"] : ["READY", "SENT"];
  const totals = (status: string) => shipments.filter(s => s.status === status).reduce((n, s) => n + s.items.reduce((q, i) => q + i.quantity, 0), 0);
  const wrap = (value: string, maxWidth: number) => {
    doc.font("Body").fontSize(9);
    const result: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (line && doc.widthOfString(`${line} ${word}`) > maxWidth) { result.push(line); line = ""; }
        if (doc.widthOfString(word) > maxWidth) {
          for (const char of word) {
            if (line && doc.widthOfString(line + char) > maxWidth) { result.push(line); line = ""; }
            line += char;
          }
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      result.push(line);
    }
    return result.length ? result : [""];
  };
  const header = () => {
    doc.font("Bold").fontSize(12).fillColor("#0f4c81").text("Flachenschneeschieber", left, 36);
    doc.font("Body").fontSize(8).fillColor("#475569").text(`${t.title} | ${stamp}`, left, 54);
    y = 74;
  };
  const newPage = () => { doc.addPage(); header(); };
  const textBlock = (text: string, color = "#334155", bold = false) => {
    for (const line of wrap(text, width - 16)) {
      if (y + 14 > bottom) newPage();
      doc.font(bold ? "Bold" : "Body").fontSize(9).fillColor(color).text(line, left + 8, y, { lineBreak: false });
      y += 14;
    }
  };
  const tableHeader = () => {
    doc.rect(left, y, width, 24).fill("#eff6ff");
    let x = left;
    [`${t.company} / ${t.address}`, t.plow].forEach((label, i) => {
      doc.font("Bold").fontSize(8).fillColor("#334155").text(label, x + 6, y + 7, { width: columnWidths[i] - 12, lineBreak: false }); x += columnWidths[i];
    });
    y += 24;
  };
  const row = (cells: string[], continuation: string) => {
    const lines = cells.map((cell, i) => wrap(cell, columnWidths[i] - 12));
    let offset = 0;
    const total = Math.max(...lines.map(c => c.length));
    while (offset < total) {
      if (y + 26 > bottom) { newPage(); textBlock(continuation, "#0f4c81", true); tableHeader(); }
      const take = Math.min(total - offset, Math.floor((bottom - y - 12) / 13));
      const height = take * 13 + 12;
      doc.rect(left, y, width, height).fill("#f8fafc");
      let x = left;
      lines.forEach((cell, i) => {
        cell.slice(offset, offset + take).forEach((line, j) => {
          const isCompany = i === 0 && offset + j === 0;
          doc.font(i === 1 || isCompany ? "Bold" : "Body").fontSize(9).fillColor(i === 0 && !isCompany ? "#64748b" : "#0f172a");
          doc.text(line, x + 6, y + 6 + j * 13, { lineBreak: false });
        });
        x += columnWidths[i];
      });
      doc.moveTo(left, y + height).lineTo(left + width, y + height).strokeColor("#d8e1ef").stroke();
      y += height; offset += take;
    }
  };
  header();
  for (const [sectionIndex, status] of selected.entries()) {
    if (sectionIndex > 0) newPage();
    const group = shipments.filter(s => s.status === status && s.items.length > 0);
    const statusTitle = status === "READY" ? t.ready : t.sent;
    if (y + 38 > bottom) newPage();
    doc.rect(left, y, width, 28).fill(status === "READY" ? "#fff7ed" : "#ecfdf5");
    doc.font("Bold").fontSize(11).fillColor(status === "READY" ? "#9a3412" : "#166534").text(`${statusTitle} - ${totals(status)} ${t.plows}`, left + 8, y + 8, { lineBreak: false });
    y += 38;
    if (!group.length) textBlock(t.empty);
    else tableHeader();
    for (const shipment of group) {
      const address = [shipment.street, `${shipment.postalCode} ${shipment.city}`.trim(), shipment.country].filter(Boolean).join(", ");
      const plows = shipment.items.map(item => `${item.model.replace("_", " ")} ${item.serialNumber}-${item.buildNumber}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`).join("\n");
      row([`${shipment.companyName}\n${address}`, plows], `${statusTitle} (${t.continued})`);
    }
  }
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font("Body").fontSize(8).fillColor("#64748b").text(`${t.page} ${i + 1} / ${pages.count}`, left, doc.page.height - 48, { width, align: "center", lineBreak: false });
  }
  doc.end();
  return finished;
}
