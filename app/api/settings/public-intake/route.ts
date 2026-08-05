import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { getPublicIntakeSetting, setPublicIntakeSetting } from "@/lib/store";

const schema = z.object({ enabled: z.boolean() }).strict();

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "settings:read");

    return NextResponse.json({ enabled: await getPublicIntakeSetting() });
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Could not load public intake settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiPermission(request, "settings:write");
    const body = schema.parse(await request.json());

    return NextResponse.json({ enabled: await setPublicIntakeSetting(body.enabled) });
  } catch (error) {
    const auth = authErrorResponse(error);

    if (auth) return auth;

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid setting." }, { status: 400 });
    }

    const conflict = error instanceof Error && error.message === "Public audit intake is already enabled for another organization.";

    return NextResponse.json(
      { error: conflict ? error.message : "Could not update public intake settings." },
      { status: conflict ? 409 : 500 },
    );
  }
}
