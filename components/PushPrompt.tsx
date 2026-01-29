"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { labels } from "@/lib/i18n";

type NotificationTypes = {
  lowStock: boolean;
  ready: boolean;
  importErrors: boolean;
  stockChange: boolean;
};

const defaultTypes: NotificationTypes = {
  lowStock: true,
  ready: true,
  importErrors: true,
  stockChange: true,
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true);

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function PushPrompt({ lang }: { lang?: Lang }) {
  const [activeLang, setActiveLang] = useState<Lang>(lang ?? "pl");
  const [isOpen, setIsOpen] = useState(false);
  const [types, setTypes] = useState<NotificationTypes>(defaultTypes);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = labels[activeLang];

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }, []);

  useEffect(() => {
    if (!lang && typeof window !== "undefined") {
      const stored = window.localStorage.getItem("plugs-tracker-lang");
      if (stored === "pl" || stored === "de") {
        setActiveLang(stored);
      }
    }
  }, [lang]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }
    if (Notification.permission === "denied") {
      return;
    }
    const load = async () => {
      const response = await fetch("/api/push/preferences", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const askAfter = data.askAfter ? new Date(data.askAfter) : null;
      const now = new Date();
      if (data.optIn === "ENABLED" || data.optIn === "DENIED") {
        return;
      }
      if (data.optIn === "LATER" && askAfter && askAfter > now) {
        return;
      }
      if (data.notificationTypes) {
        setTypes({ ...defaultTypes, ...data.notificationTypes });
      }
      setIsOpen(true);
    };
    load().catch(() => null);
  }, [isSupported]);

  const updateType = (key: keyof NotificationTypes) =>
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleLater = async () => {
    setIsSubmitting(true);
    await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "later", askAfterDays: 7, locale: activeLang }),
    }).catch(() => null);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deny", locale: activeLang }),
    }).catch(() => null);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  const handleEnable = async () => {
    setError(null);
    if (!isSupported) {
      setError(t.pushPromptUnsupported);
      return;
    }
    setIsSubmitting(true);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      await fetch("/api/push/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny", locale: activeLang }),
      }).catch(() => null);
      setIsSubmitting(false);
      setIsOpen(false);
      return;
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    const publicKeyRes = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!publicKeyRes.ok) {
      setError(t.pushPromptError);
      setIsSubmitting(false);
      return;
    }
    const { key } = await publicKeyRes.json();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        notificationTypes: types,
        userAgent: navigator.userAgent,
        locale: activeLang,
      }),
    });
    if (!response.ok) {
      setError(t.pushPromptError);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen || !isSupported) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <section className="card modal-card push-modal">
        <div className="card-header">
          <div>
            <h3 className="title">{t.pushPromptTitle}</h3>
            <p className="subtitle">{t.pushPromptDescription}</p>
          </div>
        </div>

        {isIOS() && !isStandalone() && (
          <div className="alert">{t.pushPromptIosHint}</div>
        )}

        <div className="push-types">
          <p className="muted">{t.pushPromptTypes}</p>
          <label className="push-type">
            <input
              type="checkbox"
              checked={types.lowStock}
              onChange={() => updateType("lowStock")}
            />
            {t.pushPromptTypeLowStock}
          </label>
          <label className="push-type">
            <input
              type="checkbox"
              checked={types.ready}
              onChange={() => updateType("ready")}
            />
            {t.pushPromptTypeReady}
          </label>
          <label className="push-type">
            <input
              type="checkbox"
              checked={types.importErrors}
              onChange={() => updateType("importErrors")}
            />
            {t.pushPromptTypeImportErrors}
          </label>
          <label className="push-type">
            <input
              type="checkbox"
              checked={types.stockChange}
              onChange={() => updateType("stockChange")}
            />
            {t.pushPromptTypeStockChange}
          </label>
        </div>

        {error && <div className="alert">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="button"
            onClick={handleEnable}
            disabled={isSubmitting}
          >
            {t.pushPromptEnable}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleLater}
            disabled={isSubmitting}
          >
            {t.pushPromptLater}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleDeny}
            disabled={isSubmitting}
          >
            {t.pushPromptDecline}
          </button>
        </div>
      </section>
    </div>
  );
}
