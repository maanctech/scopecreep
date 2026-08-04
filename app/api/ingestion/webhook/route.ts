import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { createWebhookConnection } from "@/lib/ingestion/webhook";

const schema = z
  .object({
    projectId: z.uuid(),
    name: z.string().trim().min(2).max(120),
  })
  .strict();

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "integrations:write");

    return NextResponse.json(
      {
        connection: await createWebhookConnection(
          schema.parse(await request.json()),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return (
      authErrorResponse(error) ||
      NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message
              : "Webhook connection could not be created.",
        },
        { status: error instanceof z.ZodError ? 400 : 422 },
      )
    );
  }
}
