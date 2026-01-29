import webPush from "web-push";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { labels, Lang } from "@/lib/i18n";

type NotificationTypes = {
  lowStock?: boolean;
  ready?: boolean;
  importErrors?: boolean;
  stockChange?: boolean;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
  badge?: string;
};

const defaultTypes: NotificationTypes = {
  lowStock: true,
  ready: true,
  importErrors: true,
  stockChange: true,
};

const getVapidDetails = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  if (!publicKey || !privateKey || !subject) {
    throw new Error("Missing VAPID env");
  }
  return { publicKey, privateKey, subject };
};

const ensureWebPush = () => {
  const { publicKey, privateKey, subject } = getVapidDetails();
  webPush.setVapidDetails(subject, publicKey, privateKey);
};

export const getAppNotificationPreference = async () => {
  const userId = getAppUser();
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  return pref;
};

const resolveLang = (value?: string | null): Lang => {
  if (value === "pl" || value === "de") {
    return value;
  }
  return "de";
};

export const buildPushPayload = (
  key: "ready" | "lowStock" | "importErrors" | "test" | "stockChange",
  lang: Lang,
  data?: {
    shipmentId?: number;
    partName?: string;
    stock?: number;
    status?: string;
    itemName?: string;
    delta?: number;
    nextQuantity?: number;
  }
): PushPayload => {
  const t = labels[lang];
  if (key === "ready") {
    return {
      title: t.pushReadyTitle,
      body: t.pushReadyBody
        .replace("{id}", String(data?.shipmentId ?? ""))
        .replace("{status}", String(data?.status ?? "")),
      url: "/sent",
      tag: "shipment-ready",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    };
  }
  if (key === "lowStock") {
    return {
      title: t.pushLowStockTitle,
      body: t.pushLowStockBody
        .replace("{name}", String(data?.partName ?? ""))
        .replace("{stock}", String(data?.stock ?? "")),
      url: "/parts",
      tag: "low-stock",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    };
  }
  if (key === "stockChange") {
    return {
      title: t.pushStockChangeTitle,
      body: t.pushStockChangeBody
        .replace("{name}", String(data?.itemName ?? ""))
        .replace("{delta}", String(data?.delta ?? ""))
        .replace("{stock}", String(data?.nextQuantity ?? "")),
      url: "/",
      tag: "stock-change",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    };
  }
  if (key === "importErrors") {
    return {
      title: t.pushImportErrorTitle,
      body: t.pushImportErrorBody,
      url: "/admin",
      tag: "import-error",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    };
  }
  return {
    title: t.pushTestTitle,
    body: t.pushTestBody,
    url: "/admin",
    tag: "test",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };
};

export const sendPushToUser = async (
  userId: string,
  payload: PushPayload,
  typeKey?: keyof NotificationTypes
) => {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!pref || pref.notificationsOptIn !== "ENABLED") {
    return;
  }
  const types = (pref.notificationTypes as NotificationTypes | null) ?? defaultTypes;
  if (typeKey && types[typeKey] === false) {
    return;
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true },
  });
  if (!subs.length) {
    return;
  }

  ensureWebPush();
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          });
        }
      }
    })
  );
};

export const getAppLang = async () => {
  const pref = await getAppNotificationPreference();
  return resolveLang(pref?.locale);
};
