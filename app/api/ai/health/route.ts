import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { configuredProviderHealth } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "settings:read");
    return NextResponse.json({ health: await configuredProviderHealth() });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "AI health check failed." }, { status: 500 });
  }
}
