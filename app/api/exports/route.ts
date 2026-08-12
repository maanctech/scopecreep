import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { listDataExports, requestDataExport } from "@/lib/exports/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "settings:read");

    return NextResponse.json({ exports: await listDataExports() });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Failed to list exports." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "settings:write");

    return NextResponse.json(await requestDataExport(), { status: 201 });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "The export could not be produced." }, { status: 500 });
  }
}
