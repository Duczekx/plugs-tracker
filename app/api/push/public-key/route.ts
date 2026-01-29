import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!key) {
    return NextResponse.json({ message: "Missing VAPID key" }, { status: 500 });
  }
  return NextResponse.json({ key });
}
