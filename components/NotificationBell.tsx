"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function NotificationBell({ lang }: { lang?: Lang }) {
  const [activeLang, setActiveLang] = useState<Lang>(lang ?? "pl");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = labels[activeLang];

  const supportsPush = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
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
    if (lang) {
      setActiveLang(lang);
    }
  }, [lang]);

  const refreshStatus = async () => {
    if (!supportsPush) {
      return;
    }
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setHasSubscription(Boolean(sub));
    } catch {
      setHasSubscription(false);
    }
  };

  useEffect(() => {
    refreshStatus().catch(() => null);
  }, [supportsPush]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    refreshStatus().catch(() => null);
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onVisibility = () => refreshStatus().catch(() => null);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      if (!panelRef.current) {
        return;
      }
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const subscribe = async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const publicKeyRes = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!publicKeyRes.ok) {
      throw new Error("public-key");
    }
    const keyResponse = await publicKeyRes.json();
    const key = keyResponse.publicKey ?? keyResponse.key ?? "";
    if (!key) {
      throw new Error("public-key");
    }
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    const locale = activeLang;
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        notificationTypes: defaultTypes,
        userAgent: navigator.userAgent,
        locale,
      }),
    });
    if (!response.ok) {
      throw new Error("subscribe");
    }
    setHasSubscription(true);
  };

  const handleEnable = async () => {
    setError(null);
    if (!supportsPush) {
      setError(t.pushPromptUnsupported);
      return;
    }
    setIsBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        return;
      }
      await subscribe();
    } catch {
      setError(t.pushPromptError);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubscribe = async () => {
    if (!supportsPush) {
      setError(t.pushPromptUnsupported);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await subscribe();
    } catch {
      setError(t.pushPromptError);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!supportsPush) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub?.endpoint,
          locale: activeLang,
        }),
      });
      if (response.ok) {
        await sub?.unsubscribe();
      }
      setHasSubscription(false);
    } catch {
      setError(t.pushPromptError);
    } finally {
      setIsBusy(false);
    }
  };

  const panelLabels = {
    title: activeLang === "pl" ? "Powiadomienia" : "Benachrichtigungen",
    enable:
      activeLang === "pl"
        ? "Wlacz powiadomienia"
        : "Benachrichtigungen aktivieren",
    activate: activeLang === "pl" ? "Aktywuj subskrypcje" : "Abo aktivieren",
    disable: activeLang === "pl" ? "Wylacz" : "Deaktivieren",
    enabled: t.pushPromptEnabled ?? (activeLang === "pl" ? "Wlaczone" : "Aktiv"),
    deniedHint:
      activeLang === "pl"
        ? "Ustawienia -> Powiadomienia -> Safari -> Witryny -> zezwol dla domeny."
        : "Einstellungen -> Mitteilungen -> Safari -> Websites -> fuer die Domain erlauben.",
  };

  const isActive = permission === "granted" && hasSubscription;
  const labelText = activeLang === "pl" ? "Powiadomienia" : "Benachrichtigungen";

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className={`button button-ghost button-icon-only notification-bell-button ${
          !isActive ? "notification-bell-attn" : ""
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={panelLabels.title}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a5 5 0 0 0-5 5v2.2c0 1.4-.5 2.7-1.4 3.8l-.6.7h14l-.6-.7a6 6 0 0 1-1.4-3.8V8a5 5 0 0 0-5-5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 18a2.5 2.5 0 0 0 5 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {!isActive && <span className="notification-bell-dot" aria-hidden="true" />}
      </button>
      <span className="notification-bell-label">{labelText}</span>

      {isOpen && isMobile && (
        <div className="modal-overlay notification-sheet-overlay" role="dialog" aria-modal="true">
          <section className="card notification-sheet">
            <button
              type="button"
              className="push-modal-close"
              aria-label={t.pushPromptClose}
              onClick={() => setIsOpen(false)}
              disabled={isBusy}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6l-12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="card-header">
              <div>
                <h3 className="title notification-sheet-title">{panelLabels.title}</h3>
                <p className="subtitle">{t.pushPromptDescription}</p>
              </div>
            </div>

            {!supportsPush && (
              <div className="alert">{t.pushPromptUnsupported}</div>
            )}

            {permission === "denied" && (
              <div className="alert">
                {t.pushPromptDeniedHint} {isIOS() ? panelLabels.deniedHint : ""}
              </div>
            )}

            {permission === "granted" && isActive && (
              <div className="alert">{panelLabels.enabled}</div>
            )}

            {error && <div className="alert">{error}</div>}

            <div className="form-actions notification-panel-actions">
              {permission === "default" && (
                <button
                  type="button"
                  className="button"
                  onClick={handleEnable}
                  disabled={isBusy}
                >
                  {panelLabels.enable}
                </button>
              )}
              {permission === "granted" && !hasSubscription && (
                <button
                  type="button"
                  className="button"
                  onClick={handleSubscribe}
                  disabled={isBusy}
                >
                  {panelLabels.activate}
                </button>
              )}
              {permission === "granted" && hasSubscription && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={handleUnsubscribe}
                  disabled={isBusy}
                >
                  {panelLabels.disable}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {isOpen && !isMobile && (
        <div className="notification-panel card">
          <div className="card-header">
            <div>
              <h3 className="title notification-panel-title">{panelLabels.title}</h3>
              <p className="subtitle">{t.pushPromptDescription}</p>
            </div>
          </div>

          {!supportsPush && (
            <div className="alert">{t.pushPromptUnsupported}</div>
          )}

          {permission === "denied" && (
            <div className="alert">
              {t.pushPromptDeniedHint} {isIOS() ? panelLabels.deniedHint : ""}
            </div>
          )}

          {permission === "granted" && isActive && (
            <div className="alert">{panelLabels.enabled}</div>
          )}

          {error && <div className="alert">{error}</div>}

          <div className="form-actions notification-panel-actions">
            {permission === "default" && (
              <button
                type="button"
                className="button"
                onClick={handleEnable}
                disabled={isBusy}
              >
                {panelLabels.enable}
              </button>
            )}
            {permission === "granted" && !hasSubscription && (
              <button
                type="button"
                className="button"
                onClick={handleSubscribe}
                disabled={isBusy}
              >
                {panelLabels.activate}
              </button>
            )}
            {permission === "granted" && hasSubscription && (
              <button
                type="button"
                className="button button-ghost"
                onClick={handleUnsubscribe}
                disabled={isBusy}
              >
                {panelLabels.disable}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

