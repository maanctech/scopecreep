import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  configurePlatformConnection,
  listIntegrations,
} from "@/lib/connectors/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "integrations:read");
    return NextResponse.json({ connections: await listIntegrations() });
  } catch (error) {
    return (
      authErrorResponse(error) ||
      NextResponse.json(
        { error: "Could not load integrations." },
        { status: 500 },
      )
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "integrations:write");
    return NextResponse.json(
      { connection: await configurePlatformConnection(await request.json()) },
      { status: 201 },
    );
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : "The integration configuration could not be saved.",
      },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
