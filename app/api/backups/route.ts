import { NextResponse } from "next/server";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { createBackup, listBackups } from "@/lib/backups/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "backups:read");

    return NextResponse.json({ backups: await listBackups() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Backups could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "backups:write");

    return NextResponse.json({ backup: await createBackup() }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    const message = error instanceof Error && /system administrator/.test(error.message)
      ? error.message
      : "Backup creation failed. Verify PostgreSQL client tools, backup path, and filesystem permissions.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
