"use client";

import { useEffect } from "react";

export default function PushRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);

  return null;
}
