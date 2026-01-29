import { Suspense } from "react";
import PartsPageClient from "./parts-page-client";

export default function PartsPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <div className="app-content">
            <section className="card parts-card">
              <div className="muted">Loading...</div>
            </section>
          </div>
        </div>
      }
    >
      <PartsPageClient />
    </Suspense>
  );
}
