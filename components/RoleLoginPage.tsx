"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { labels } from "@/lib/i18n";

type Role = "VIEWER" | "EDITOR";

type RoleLoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
  forceRole?: Role;
};

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return "";
  }
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  if (!match) {
    return "";
  }
  return match.slice(name.length + 1);
};

const setRoleTargetCookie = (role: Role) => {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `pt_role_target=${role}; path=/; max-age=${60 * 60 * 24 * 30}`;
};

export default function RoleLoginPage({ searchParams, forceRole }: RoleLoginPageProps) {
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

  const [role, setRole] = useState<Role>(() => {
    if (forceRole) {
      return forceRole;
    }
    const cookieRole = getCookieValue("pt_role_target");
    return cookieRole === "EDITOR" ? "EDITOR" : "VIEWER";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    if (forceRole && role !== forceRole) {
      setRole(forceRole);
    }
  }, [forceRole, role]);

  useEffect(() => {
    setRoleTargetCookie(role);
  }, [role]);

  const t = labels[lang];
  const error = searchParams?.error;
  const next = searchParams?.next ?? "/";

  const text = useMemo(() => {
    if (role === "EDITOR") {
      return {
        title: t.editorLoginTitle,
        subtitle: t.editorLoginSubtitle,
        button: t.editorLoginButton,
        error: t.editorLoginError,
        missing: t.editorLoginMissing,
      };
    }
    return {
      title: t.viewerLoginTitle,
      subtitle: t.viewerLoginSubtitle,
      button: t.viewerLoginButton,
      error: t.viewerLoginError,
      missing: t.viewerLoginMissing,
    };
  }, [role, t]);

  return (
    <div className="app-shell">
      <div className="app-content">
        <section className="card card-narrow">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">{text.title}</h1>
              <p className="subtitle">{text.subtitle}</p>
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

          {error === "invalid" && <div className="alert">{text.error}</div>}
          {error === "missing" && <div className="alert">{text.missing}</div>}

          <form className="form" action="/api/role-login" method="post">
            <label>
              {t.passwordLabel}
              <input type="password" name="password" autoFocus required />
            </label>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="next" value={next} />
            <div className="form-actions">
              <button className="button" type="submit">
                {text.button}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

