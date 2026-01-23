"use client";

import { useEffect, useState } from "react";
import { labels, Lang } from "@/lib/i18n";

export default function AdminLogin() {
  const [lang, setLang] = useState<Lang>("pl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<"invalid" | "missing" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("plugs-tracker-lang");
      if (stored === "pl" || stored === "de") {
        setLang(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  const t = labels[lang];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Admin", password }),
    });
    if (response.ok) {
      window.location.href = "/admin";
      return;
    }
    if (response.status === 500) {
      setError("missing");
    } else {
      setError("invalid");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <section className="card card-narrow">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">{t.adminLoginTitle}</h1>
              <p className="subtitle">{t.adminLoginSubtitle}</p>
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

          {error === "invalid" && <div className="alert">{t.adminLoginError}</div>}
          {error === "missing" && <div className="alert">{t.adminLoginMissing}</div>}

          <form className="form" onSubmit={handleSubmit}>
            <label>
              {t.adminUserLabel}
              <input value="Admin" disabled />
            </label>
            <label>
              {t.adminPasswordLabel}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                required
              />
            </label>
            <div className="form-actions">
              <button className="button" type="submit" disabled={isSubmitting}>
                {t.adminLoginButton}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
