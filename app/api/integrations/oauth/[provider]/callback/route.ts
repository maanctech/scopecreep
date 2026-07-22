import { NextResponse } from "next/server";
import { z } from "zod";
import { completeOAuthAuthorization } from "@/lib/connectors/oauth";
import { testPlatformConnection } from "@/lib/connectors/service";

const providerSchema = z.enum(["google", "microsoft"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const appUrl = process.env.APP_URL || new URL(request.url).origin;
  const target = new URL("/app/integrations", appUrl);
  try {
    const providerKey = providerSchema.parse((await params).provider);
    const url = new URL(request.url);
    if (url.searchParams.get("error"))
      throw new Error("Authorization was denied by the provider.");
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (!state || !code)
      throw new Error("Authorization response is incomplete.");
    const completed = await completeOAuthAuthorization({
      provider: providerKey === "google" ? "Google" : "Microsoft",
      state,
      code,
    });
    await testPlatformConnection(completed.connectionId);
    target.searchParams.set("notice", "authorization-complete");
  } catch {
    target.searchParams.set("notice", "authorization-failed");
  }
  return NextResponse.redirect(target);
}
