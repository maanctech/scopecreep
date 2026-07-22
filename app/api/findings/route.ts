import { NextResponse } from "next/server";
import { getFindings } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "findings:read");
    const findings = await getFindings();
    return NextResponse.json({ findings });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Failed to load findings." }, { status: 500 });
  }
}
