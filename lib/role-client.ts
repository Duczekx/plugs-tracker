export type AppRole = "VIEWER" | "EDITOR" | null;

export const fetchRole = async (): Promise<AppRole> => {
  try {
    const response = await fetch("/api/role/me", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const role = data?.role;
    if (role === "VIEWER" || role === "EDITOR") {
      return role;
    }
    return null;
  } catch {
    return null;
  }
};

