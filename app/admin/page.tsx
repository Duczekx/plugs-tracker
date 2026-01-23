import { cookies } from "next/headers";
import { getAdminCookieName, verifyAdminSession } from "@/lib/admin-auth";
import AdminLogin from "./login-form";
import AdminPanel from "./panel";

export default async function AdminPage() {
  const cookieValue = cookies().get(getAdminCookieName())?.value;
  const isAdmin = await verifyAdminSession(cookieValue);

  if (!isAdmin) {
    return <AdminLogin />;
  }

  return <AdminPanel />;
}
