import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { systemDiagnostics } from "@/lib/operations/diagnostics";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "settings:read");

    return NextResponse.json({ diagnostics: await systemDiagnostics() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Diagnostics are unavailable." }, { status: 500 });
  }
}
