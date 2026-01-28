"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";
import MobileNav from "@/app/mobile-nav";

type ActivityLog = {
  id: number;
  createdAt: string;
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  meta: unknown;
};

const STORAGE_KEY = "plugs-tracker-admin-key";

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

export default function ActivityPage() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("plugs-tracker-lang");
        if (stored === "pl" || stored === "de") {
          return stored;
        }
      } catch {}
    }
    return "pl";
  });
  const pathname = usePathname();
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [adminInput, setAdminInput] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const t = labels[lang];

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAdminKey(stored);
        setAdminInput(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(queryInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [queryInput]);

  const canFetch = useMemo(() => Boolean(adminKey), [adminKey]);

  const fetchLogs = async (options?: { reset?: boolean; cursor?: number | null }) => {
    if (!adminKey) {
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("take", "50");
    if (options?.cursor) {
      params.set("cursor", String(options.cursor));
    }
    if (query) {
      params.set("q", query);
    }
    try {
      const response = await fetch(`/api/activity?${params.toString()}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      });
      if (response.status === 401) {
        setError("Brak dostepu. Podaj poprawny Admin key.");
        return;
      }
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as {
        items: ActivityLog[];
        nextCursor: number | null;
      };
      setLogs((prev) => (options?.reset ? data.items : [...prev, ...data.items]));
      setNextCursor(data.nextCursor);
    } catch {
      setError("Nie udalo sie pobrac historii.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canFetch) {
      return;
    }
    setLogs([]);
    setNextCursor(null);
    fetchLogs({ reset: true, cursor: null });
  }, [canFetch, query]);

  const handleSaveKey = () => {
    const trimmed = adminInput.trim();
    if (!trimmed) {
      setError("Admin key jest wymagany.");
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {}
    setAdminKey(trimmed);
  };

  const handleLogout = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setAdminKey(null);
    setLogs([]);
    setNextCursor(null);
    setAdminInput("");
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="card">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="currentColor"
                      opacity="0.14"
                    />
                    <path
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Historia
              </h1>
              <p className="subtitle">Dziennik aktywnosci systemu</p>
            </div>
            <div />
          </div>
        </header>
        <div className="sticky-nav">
          <div className="sticky-nav-inner">
            <MobileNav lang={lang} setLang={setLang} pathname={pathname} t={t} />
            <div className="tabs">
              <Link
                className={`tab-link ${pathname === "/" ? "tab-active" : ""}`}
                href="/"
              >
                {t.inventoryTab}
              </Link>
              <Link
                className={`tab-link ${
                  pathname === "/shipments" ? "tab-active" : ""
                }`}
                href="/shipments"
              >
                {t.shipmentsTab}
              </Link>
              <Link
                className={`tab-link ${pathname === "/sent" ? "tab-active" : ""}`}
                href="/sent"
              >
                {t.sentTab}
              </Link>
              <span className="tab-link tab-active">Historia</span>
            </div>
            <div className="lang-toggle">
              <span className="pill">{t.languageToggle}</span>
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
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">Historia zmian</h2>
              <p className="subtitle">Dostep tylko dla admina</p>
            </div>
            {adminKey && (
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={handleLogout}
              >
                Wyloguj
              </button>
            )}
          </div>

          {!adminKey ? (
            <div className="form">
              <label>
                Admin key
                <input
                  type="password"
                  value={adminInput}
                  onChange={(event) => setAdminInput(event.target.value)}
                  placeholder="Wklej Admin key"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="button" onClick={handleSaveKey}>
                  Zapisz
                </button>
              </div>
              {error && <div className="alert">{error}</div>}
            </div>
          ) : (
            <>
              <div className="filter-row">
                <span className="pill">Szukaj</span>
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Szukaj w historii"
                />
              </div>

              {error && <div className="alert">{error}</div>}

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Typ</th>
                      <th>Encja</th>
                      <th>Opis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4}>Brak wpisow</td>
                      </tr>
                    )}
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatTimestamp(log.createdAt)}</td>
                        <td>{log.type}</td>
                        <td>
                          {log.entityType} #{log.entityId}
                        </td>
                        <td>{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => fetchLogs({ cursor: nextCursor })}
                  disabled={loading || !nextCursor}
                >
                  {loading ? "Laduje..." : "Wczytaj wiecej"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
