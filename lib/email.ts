import nodemailer from "nodemailer";
import type { Shipment, ShipmentExtraItem, ShipmentItem } from "@prisma/client";

type ShipmentWithDetails = Shipment & {
  items: ShipmentItem[];
  extras: ShipmentExtraItem[];
};

type EmailType = "ready" | "sent";

const modelLabel: Record<string, string> = {
  FL_640: "FL 640",
  FL_540: "FL 540",
  FL_470: "FL 470",
  FL_400: "FL 400",
  FL_340: "FL 340",
  FL_260: "FL 260",
};

const variantLabel: Record<string, string> = {
  ZINC: "Zink",
  ORANGE: "Orange",
};

const valveLabel: Record<string, string> = {
  NONE: "Keine",
  SMALL: "Grau",
  LARGE: "Schwarz",
};

const formatDate = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString().slice(0, 10);
};

const renderItemsTable = (items: ShipmentItem[]) => {
  if (!items.length) {
    return "<p style=\"margin: 0; color: #6b7280;\">Keine Positionen.</p>";
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            ${modelLabel[item.model] ?? item.model} ${item.serialNumber}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${variantLabel[item.variant] ?? item.variant}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${item.buildNumber}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(item.buildDate)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            ${item.isSchwenkbock ? "Ja" : "Nein"}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            ${item.bucketHolder ? "Ja" : "Nein"}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            ${valveLabel[item.valveType] ?? item.valveType}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6; text-align: left;">
          <th style="padding: 10px 12px;">Modell</th>
          <th style="padding: 10px 12px;">Variante</th>
          <th style="padding: 10px 12px;">Menge</th>
          <th style="padding: 10px 12px;">Bau-Nr</th>
          <th style="padding: 10px 12px;">Datum</th>
          <th style="padding: 10px 12px;">Schwenkbock</th>
          <th style="padding: 10px 12px;">Eimerhalter</th>
          <th style="padding: 10px 12px;">Ventil</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const renderExtrasTable = (extras: ShipmentExtraItem[]) => {
  if (!extras.length) {
    return "";
  }

  const rows = extras
    .map(
      (extra) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${extra.name}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${extra.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            ${extra.note ? extra.note : "-"}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <h3 style="margin: 24px 0 10px; font-size: 16px;">Zusatzteile</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6; text-align: left;">
          <th style="padding: 10px 12px;">Bezeichnung</th>
          <th style="padding: 10px 12px;">Menge</th>
          <th style="padding: 10px 12px;">Notiz</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const buildEmailHtml = (shipment: ShipmentWithDetails, type: EmailType) => {
  const headline =
    type === "ready" ? "Versandbereit gemeldet" : "Versand bestaetigt";
  const intro =
    type === "ready"
      ? "Die folgende Sendung ist vorbereitet und bereit fuer den Versand."
      : "Die folgende Sendung wurde an den Kunden verschickt.";
  const badge =
    type === "ready"
      ? "<span style=\"display: inline-block; padding: 6px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700;\">VERSANDBEREIT</span>"
      : "<span style=\"display: inline-block; padding: 6px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700;\">VERSENDET</span>";

  const addressLine = `${shipment.street}, ${shipment.postalCode} ${shipment.city}, ${shipment.country}`;

  return `
    <div style="font-family: Arial, sans-serif; background: #f6f7fb; padding: 24px;">
      <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <h1 style="margin: 0; font-size: 22px; color: #111827;">${headline}</h1>
          ${badge}
        </div>
        <p style="margin: 10px 0 16px; color: #4b5563;">${intro}</p>
        <div style="margin: 0 0 16px; font-size: 12px; color: #6b7280;">
          Datum: ${formatDate(shipment.createdAt)}
        </div>
        <div style="padding: 16px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 18px;">
          <div style="font-weight: 600; margin-bottom: 6px;">${shipment.companyName}</div>
          <div style="color: #6b7280; font-size: 14px;">
            ${shipment.firstName} ${shipment.lastName}<br />
            ${addressLine}
          </div>
        </div>
        ${renderItemsTable(shipment.items)}
        ${renderExtrasTable(shipment.extras)}
        ${
          shipment.notes
            ? `<p style="margin: 20px 0 0; color: #6b7280;"><strong>Notizen:</strong> ${shipment.notes}</p>`
            : ""
        }
        <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
          Automatisch generiert durch die Anwendung FS LAGER.
        </p>
      </div>
    </div>
  `;
};

const buildEmailText = (shipment: ShipmentWithDetails, type: EmailType) => {
  const headline =
    type === "ready" ? "Versandbereit gemeldet" : "Versand bestaetigt";
  const intro =
    type === "ready"
      ? "Die folgende Sendung ist vorbereitet und bereit fuer den Versand."
      : "Die folgende Sendung wurde an den Kunden verschickt.";

  const addressLine = `${shipment.street}, ${shipment.postalCode} ${shipment.city}, ${shipment.country}`;

  const items = shipment.items
    .map(
      (item) =>
        `- ${modelLabel[item.model] ?? item.model} ${item.serialNumber} | ${variantLabel[item.variant] ?? item.variant} | Menge: ${item.quantity} | Bau-Nr: ${item.buildNumber} | Datum: ${formatDate(item.buildDate)} | Schwenkbock: ${item.isSchwenkbock ? "Ja" : "Nein"} | Eimerhalter: ${item.bucketHolder ? "Ja" : "Nein"} | Ventil: ${valveLabel[item.valveType] ?? item.valveType}`
    )
    .join("\n");

  const extras = shipment.extras.length
    ? shipment.extras
        .map(
          (extra) =>
            `- ${extra.name} | Menge: ${extra.quantity} | Notiz: ${extra.note ? extra.note : "-"}`
        )
        .join("\n")
    : "Keine Zusatzteile.";

  return [
    headline,
    intro,
    `Datum: ${formatDate(shipment.createdAt)}`,
    "",
    `${shipment.companyName}`,
    `${shipment.firstName} ${shipment.lastName}`,
    addressLine,
    "",
    "Positionen:",
    items || "Keine Positionen.",
    "",
    "Zusatzteile:",
    extras,
    shipment.notes ? `\nNotizen: ${shipment.notes}` : "",
    "",
    "Automatisch generiert durch die Anwendung FS LAGER.",
  ]
    .filter(Boolean)
    .join("\n");
};

export const sendShipmentEmail = async (
  shipment: ShipmentWithDetails,
  type: EmailType
) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;

  if (!resendApiKey || !mailFrom) {
    throw new Error("Missing Resend configuration");
  }

  const recipients = [process.env.EMAIL_1, process.env.EMAIL_2].filter(
    (value): value is string => Boolean(value)
  );
  if (recipients.length === 0) {
    throw new Error("Missing recipients");
  }

  const subject =
    type === "ready"
      ? `Versandbereit: ${shipment.companyName}`
      : `Versendet: ${shipment.companyName}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Plugs Tracker <${mailFrom}>`,
      to: recipients,
      subject,
      html: buildEmailHtml(shipment, type),
      text: buildEmailText(shipment, type),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.message || `Resend error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  console.info("Email sent", {
    shipmentId: shipment.id,
    provider: "resend",
    messageId: payload?.id ?? null,
    recipients,
  });
};
