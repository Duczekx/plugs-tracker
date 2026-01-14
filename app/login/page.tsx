"use client";

import { useEffect, useState } from "react";
import { labels, Lang } from "@/lib/i18n";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
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

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  const t = labels[lang];
  const error = searchParams?.error;
  const next = searchParams?.next ?? "/";

  return (
    <div className="app-shell">
      <div className="app-content">
        <section className="card card-narrow">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">{t.loginTitle}</h1>
              <p className="subtitle">{t.loginSubtitle}</p>
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

          {error === "invalid" && <div className="alert">{t.loginError}</div>}
          {error === "missing" && <div className="alert">{t.loginMissing}</div>}

          <form className="form" action="/api/login" method="post">
            <label>
              {t.passwordLabel}
              <input type="password" name="password" autoFocus required />
            </label>
            <input type="hidden" name="next" value={next} />
            <div className="form-actions">
              <button className="button" type="submit">
                {t.loginButton}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
