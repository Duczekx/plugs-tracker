"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { labels, type Lang } from "@/lib/i18n";

type Labels = (typeof labels)["pl"];

type MobileNavProps = {
  lang: Lang;
  setLang: (next: Lang) => void;
  pathname: string;
  t: Labels;
};

export default function MobileNav({ lang, setLang, pathname, t }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerTop, setDrawerTop] = useState(0);

  const items = useMemo(
    () => [
      { href: "/", label: t.inventoryTab },
      { href: "/parts", label: t.partsTab, subLabel: t.partsPageTitle },
      { href: "/shipments", label: t.shipmentsTab },
      { href: "/sent", label: t.sentTab },
    ],
    [t]
  );

  const updateDrawerTop = () => {
    if (typeof document === "undefined") {
      return;
    }
    const header = document.querySelector("header.card");
    if (!header) {
      setDrawerTop(0);
      return;
    }
    const rect = header.getBoundingClientRect();
    const nextTop = Math.max(0, Math.round(rect.bottom));
    setDrawerTop(nextTop);
  };

  useEffect(() => {
    updateDrawerTop();
    if (typeof window === "undefined") {
      return;
    }
    window.addEventListener("resize", updateDrawerTop);
    return () => window.removeEventListener("resize", updateDrawerTop);
  }, []);

  useEffect(() => {
    updateDrawerTop();
  }, [isOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
    document.body.style.overflow = "";
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        className="button button-ghost button-icon-only mobile-nav-trigger mobile-only"
        onClick={() => setIsOpen(true)}
        aria-label="Otworz menu"
        aria-expanded={isOpen}
        aria-controls="mobile-drawer"
      >
        <span className="mobile-nav-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        className={`mobile-drawer ${isOpen ? "open" : ""}`}
        id="mobile-drawer"
        style={{ ["--mobile-drawer-top" as string]: `${drawerTop}px` }}
      >
        <button
          type="button"
          className="mobile-drawer-overlay"
          aria-label="Zamknij menu"
          onClick={closeMenu}
        />
        <aside className="mobile-drawer-panel" role="dialog" aria-modal="true">
          <div className="mobile-drawer-header">
            <span className="pill">Menu</span>
            <button
              type="button"
              className="button button-ghost button-icon-only mobile-drawer-close"
              onClick={closeMenu}
              aria-label="Zamknij menu"
            >
              <svg className="mobile-drawer-close-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6l-12 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <nav className="mobile-drawer-links">
            {items.map((item) => (
              <Link
                key={item.href}
                className={`mobile-drawer-link ${
                  pathname === item.href ? "active" : ""
                }`}
                href={item.href}
                onClick={closeMenu}
              >
                <span className="mobile-drawer-title">{item.label}</span>
                {item.subLabel && (
                  <span className="mobile-drawer-subtitle">{item.subLabel}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mobile-drawer-footer">
            <div className="mobile-drawer-lang">
              <span className="mobile-drawer-lang-label">
                <span className="mobile-drawer-lang-icon" aria-hidden="true">
                  🌐
                </span>
                {t.languageToggle}
              </span>
              <div className="lang-buttons">
                <button
                  type="button"
                  className={`lang-btn ${lang === "pl" ? "active" : ""}`}
                  onClick={() => setLang("pl")}
                >
                  PL
                </button>
                <button
                  type="button"
                  className={`lang-btn ${lang === "de" ? "active" : ""}`}
                  onClick={() => setLang("de")}
                >
                  DE
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
