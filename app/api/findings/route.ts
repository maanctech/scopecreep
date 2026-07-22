import { NextResponse } from "next/server";
import { getFindings } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const findings = await getFindings();
    return NextResponse.json({ findings });
  } catch {
    return NextResponse.json({ error: "Failed to load findings." }, { status: 500 });
  }
}
