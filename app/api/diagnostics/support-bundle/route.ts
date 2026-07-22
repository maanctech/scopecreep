import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { supportBundle } from "@/lib/operations/diagnostics";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "settings:read");
    const content = JSON.stringify(await supportBundle(), null, 2);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="scopeledger-support-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Support bundle generation failed." }, { status: 500 });
  }
}
