import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import {
  configureEmailConnection,
  emailConfigSchema,
  syncEmailConnection,
  testEmailConnection,
} from "@/lib/ingestion/email";

const actionSchema = z.discriminatedUnion("action", [
  emailConfigSchema.extend({ action: z.literal("configure") }),
  z.object({ action: z.literal("test"), connectionId: z.uuid() }).strict(),
  z.object({ action: z.literal("sync"), connectionId: z.uuid() }).strict(),
]);

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "integrations:write");
    const body = actionSchema.parse(await request.json());

    if (body.action === "configure") {
      const { action: _, ...configuration } = body;

      return NextResponse.json(
        { connection: await configureEmailConnection(configuration) },
        { status: 201 },
      );
    }

    if (body.action === "test")
      return NextResponse.json(await testEmailConnection(body.connectionId));

    return NextResponse.json({
      result: await syncEmailConnection(body.connectionId),
    });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    const safe =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof Error &&
            /Email connection test failed|Email sync failed|Private or local integration hosts|valid mail server/.test(
              error.message,
            )
          ? error.message
          : "Email connection action failed.";

    return NextResponse.json(
      { error: safe },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
