import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { beginOAuthAuthorization } from "@/lib/connectors/oauth";
import {
  disablePlatformConnection,
  syncPlatformConnection,
  testPlatformConnection,
} from "@/lib/connectors/service";

const schema = z.object({
  action: z.enum(["authorize", "test", "sync", "disable"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission(request, "integrations:write");
    const { id } = await params;
    const { action } = schema.parse(await request.json());

    if (action === "authorize")
      return NextResponse.json(await beginOAuthAuthorization(id));

    if (action === "test")
      return NextResponse.json({ result: await testPlatformConnection(id) });

    if (action === "sync")
      return NextResponse.json({ result: await syncPlatformConnection(id) });

    return NextResponse.json({ result: await disablePlatformConnection(id) });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof Error &&
            /successfully before syncing|connection test failed|sync failed|APP_URL/.test(
              error.message,
            )
          ? error.message
          : "The integration action could not be completed.";

    return NextResponse.json(
      { error: message },
      { status: error instanceof z.ZodError ? 400 : 422 },
    );
  }
}
